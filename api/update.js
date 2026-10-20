module.exports = (req, res) => {
    // Cấp quyền CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // Nếu là request OPTIONS (preflight) từ browser
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Phản hồi JSON chuẩn
    return res.status(200).json({
        code: 200,
        msg: "success",
        abhotupdate_cdn_url: "https://ff-sever.vercel.app/"
    });
};
