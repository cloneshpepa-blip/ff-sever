export default function handler(req, res) {
    // Thiết lập chuẩn phản hồi JSON và mã hóa UTF-8
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    // Dữ liệu giả lập phản hồi cho quá trình hot update của game
    const hotUpdateData = {
        code: 200,
        msg: "success",
        // Trỏ tiếp về domain của bạn hoặc đường dẫn xử lý tài nguyên tiếp theo
        abhotupdate_cdn_url: "https://ten-du-an-cua-ban.vercel.app/",
        // Thông tin hiển thị tùy chỉnh giao diện vui vẻ
        player_hud_config: {
            status: "active",
            mode: "Custom Interface",
            server_time: new Date().toISOString()
        }
    };

    return res.status(200).json(hotUpdateData);
}
