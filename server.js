const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join('/tmp', 'lune_db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

function initDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [],
            products: [
                {
                    id: 1, category: 'bra', tag: 'BEST 1',
                    name: '에어핏 퓨징 심리스 브라', price: 24900, likes: 1420,
                    desc: '쫀득한 텐션감 확인하세요! 말림 없이 하루종일 찰떡 밀착되는 0.1mm 심리스 브라 ✨ #심리스브라 #노와이어',
                    colors: ['#E8D8C8', '#2C2A29', '#D8B4A6'],
                    thumb: 'https://unsplash.com',
                    videoUrl: 'https://googleapis.com'
                },
                {
                    id: 2, category: 'panty', tag: '1+1 특가',
                    name: '인비저블 노라인 헴팬티', price: 11900, likes: 980,
                    desc: '레깅스 입을 때 팬티라인 신경 쓰이셨죠? 레이저 컷팅으로 자국이 1도 안 남아요 👏 #노라인팬티 #운동복필수',
                    colors: ['#E8D8C8', '#2C2A29', '#D5C7BC'],
                    thumb: 'https://unsplash.com',
                    videoUrl: 'https://googleapis.com'
                },
                {
                    id: 3, category: 'set', tag: 'SET 할인',
                    name: '클라우드 심리스 브라 + 팬티 세트', price: 32900, likes: 2150,
                    desc: '가장 문의 많았던 스킨베이지 세트 재입고 완료! 5만원 이상 구매 시 무료배송 혜택까지 🎁 #속옷세트',
                    colors: ['#E8D8C8', '#C4A496', '#2C2A29'],
                    thumb: 'https://unsplash.com',
                    videoUrl: 'https://googleapis.com'
                }
            ],
            orders: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    }
}

const readDB = () => {
    initDB();
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!db.users) db.users = [];
    if (!db.orders) db.orders = [];
    return db;
};
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');

function checkAuth(req, res, next) {
    if (req.headers['x-admin-token'] !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    }
    next();
}

// 1. 前端用户注册
app.post('/api/auth/register', (req, res) => {
    const { username, password, name, phone } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
    }
    const db = readDB();
    if (db.users.find(u => u.username === username.trim())) {
        return res.status(400).json({ success: false, message: '이미 사용 중인 아이디입니다.' });
    }
    const newUser = {
        id: 'U' + Date.now().toString().slice(-6),
        username: username.trim(),
        password: password.trim(),
        name: (name || username).trim(),
        phone: (phone || '').trim(),
        balance: 0,
        createdAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };
    db.users.push(newUser);
    writeDB(db);
    const { password: _, ...safeUser } = newUser;
    res.json({ success: true, message: '회원가입이 완료되었습니다.', user: safeUser });
});

// 2. 前端用户登录
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === (username || '').trim() && u.password === (password || '').trim());
    if (!user) {
        return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    }
    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
});

// 3. 查询用户最新账户余额及个人订单
app.get('/api/users/:id', (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
    const { password: _, ...safeUser } = user;
    const myOrders = db.orders.filter(o => o.userId === user.id);
    res.json({ success: true, user: safeUser, orders: myOrders });
});

// 4. 获取商品列表
app.get('/api/products', (req, res) => {
    res.json({ success: true, data: readDB().products });
});

// 5. 提交订单（绑定用户账号，支持使用账户余额付款）
app.post('/api/orders', (req, res) => {
    const { userId, customer, items, total, payMethod } = req.body;
    if (!customer?.name || !customer?.phone || !customer?.address || !items?.length) {
        return res.status(400).json({ success: false, message: '주문 정보를 모두 입력해주세요.' });
    }
    const db = readDB();
    const orderTotal = Number(total);
    let currentBalance = null;

    if (payMethod === '예치금(계좌잔액) 결제') {
        if (!userId) {
            return res.status(401).json({ success: false, message: '계좌 잔액 결제는 로그인 후 이용 가능합니다.' });
        }
        const user = db.users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '회원 정보를 찾을 수 없습니다.' });
        }
        if (user.balance < orderTotal) {
            return res.status(400).json({ success: false, message: `잔액이 부족합니다. (현재 잔액: ${user.balance.toLocaleString()}원)` });
        }
        user.balance -= orderTotal;
        currentBalance = user.balance;
    }

    const newOrder = {
        orderNo: 'ORD-' + Date.now().toString().slice(-6),
        userId: userId || null,
        date: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        customer,
        items,
        total: orderTotal,
        payMethod,
        status: '결제완료 (배송준비)',
        tracking: '',
        refunded: false
    };
    db.orders.unshift(newOrder);
    writeDB(db);
    res.json({ success: true, order: newOrder, balance: currentBalance });
});

// 6. 管理员登录与商品管理
app.post('/api/admin/login', (req, res) => {
    if ((req.body.password || '').trim() === ADMIN_PASSWORD) {
        res.json({ success: true, token: ADMIN_PASSWORD });
    } else {
        res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
    }
});

app.post('/api/admin/products', checkAuth, (req, res) => {
    const { category, tag, name, price, desc, thumb, videoUrl } = req.body;
    const db = readDB();
    const newProduct = {
        id: Date.now(),
        category: category || 'bra',
        tag: tag || 'NEW',
        name,
        price: Number(price),
        likes: 0,
        desc: desc || '',
        colors: ['#E8D8C8', '#2C2A29'],
        thumb: thumb || 'https://unsplash.com',
        videoUrl: videoUrl || 'https://googleapis.com'
    };
    db.products.unshift(newProduct);
    writeDB(db);
    res.json({ success: true, product: newProduct });
});

app.put('/api/admin/products/:id', checkAuth, (req, res) => {
    const db = readDB();
    const item = db.products.find(p => p.id === Number(req.params.id));
    if (!item) return res.status(404).json({ success: false });
    item.price = Number(req.body.price);
    writeDB(db);
    res.json({ success: true });
});

app.delete('/api/admin/products/:id', checkAuth, (req, res) => {
    const db = readDB();
    db.products = db.products.filter(p => p.id !== Number(req.params.id));
    writeDB(db);
    res.json({ success: true });
});

app.get('/api/admin/orders', checkAuth, (req, res) => {
    const db = readDB();
    const safeUsers = db.users.map(({ password, ...u }) => u);
    res.json({ success: true, data: db.orders, users: safeUsers });
});

app.put('/api/admin/orders/:orderNo/tracking', checkAuth, (req, res) => {
    const db = readDB();
    const order = db.orders.find(o => o.orderNo === req.params.orderNo);
    if (!order) return res.status(404).json({ success: false });
    order.tracking = req.body.tracking;
    order.status = '배송중';
    writeDB(db);
    res.json({ success: true });
});

// 7. 后台管理员审批退款 -> 金额自动退回前端用户的账户余额
app.post('/api/admin/orders/:orderNo/refund', checkAuth, (req, res) => {
    const db = readDB();
    const order = db.orders.find(o => o.orderNo === req.params.orderNo);
    if (!order) {
        return res.status(404).json({ success: false, message: '주문을 찾을 수 없습니다.' });
    }
    if (order.refunded || order.status.includes('환불완료')) {
        return res.status(400).json({ success: false, message: '이미 환불 처리된 주문입니다.' });
    }
    if (!order.userId) {
        return res.status(400).json({ success: false, message: '비회원 주문이라 회원 계좌로 환불할 수 없습니다.' });
    }
    const user = db.users.find(u => u.id === order.userId);
    if (!user) {
        return res.status(404).json({ success: false, message: '해당 주문의 회원 계정을 찾을 수 없습니다.' });
    }

    const refundAmount = Number(order.total);
    user.balance += refundAmount;
    order.refunded = true;
    order.status = '환불완료 (계좌입금)';
    order.refundedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    writeDB(db);
    res.json({
        success: true,
        message: `${user.name}(${user.username})님의 계좌로 ${refundAmount.toLocaleString()}원이 환불 입금되었습니다.`,
        userBalance: user.balance
    });
});

initDB();
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
