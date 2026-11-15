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
            products: [
                {
                    id: 1, category: 'bra', tag: 'BEST 1',
                    name: '에어핏 퓨징 심리스 브라', price: 24900, likes: 1420,
                    desc: '쫀득한 텐션감 확인하세요! 말림 없이 하루종일 찰떡 밀착되는 0.1mm 심리스 브라 ✨ #심리스브라 #노와이어',
                    colors: ['#E8D8C8', '#2C2A29', '#D8B4A6'],
                    thumb: 'https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?auto=format&fit=crop&w=300&q=80',
                    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
                },
                {
                    id: 2, category: 'panty', tag: '1+1 특가',
                    name: '인비저블 노라인 헴팬티', price: 11900, likes: 980,
                    desc: '레깅스 입을 때 팬티라인 신경 쓰이셨죠? 레이저 컷팅으로 자국이 1도 안 남아요 👏 #노라인팬티 #운동복필수',
                    colors: ['#E8D8C8', '#2C2A29', '#D5C7BC'],
                    thumb: 'https://images.unsplash.com/photo-1605763240000-7e93b172d754?auto=format&fit=crop&w=300&q=80',
                    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
                },
                {
                    id: 3, category: 'set', tag: 'SET 할인',
                    name: '클라우드 심리스 브라 + 팬티 세트', price: 32900, likes: 2150,
                    desc: '가장 문의 많았던 스킨베이지 세트 재입고 완료! 5만원 이상 구매 시 무료배송 혜택까지 🎁 #속옷세트',
                    colors: ['#E8D8C8', '#C4A496', '#2C2A29'],
                    thumb: 'https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=300&q=80',
                    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
                }
            ],
            orders: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    }
}

const readDB = () => {
    initDB();
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
};
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');

function checkAuth(req, res, next) {
    if (req.headers['x-admin-token'] !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    }
    next();
}

app.get('/api/products', (req, res) => {
    res.json({ success: true, data: readDB().products });
});

app.post('/api/orders', (req, res) => {
    const { customer, items, total, payMethod } = req.body;
    if (!customer?.name || !customer?.phone || !customer?.address || !items?.length) {
        return res.status(400).json({ success: false, message: '주문 정보를 모두 입력해주세요.' });
    }
    const db = readDB();
    const newOrder = {
        orderNo: 'ORD-' + Date.now().toString().slice(-6),
        date: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        customer,
        items,
        total,
        payMethod,
        status: '결제완료 (배송준비)',
        tracking: ''
    };
    db.orders.unshift(newOrder);
    writeDB(db);
    res.json({ success: true, order: newOrder });
});

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
        thumb: thumb || 'https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?auto=format&fit=crop&w=300&q=80',
        videoUrl: videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
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
    res.json({ success: true, data: readDB().orders });
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

initDB();
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
