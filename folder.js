document.addEventListener('DOMContentLoaded', () => {
    // 1. Định nghĩa danh sách các cặp [Nút, Cửa sổ]
    const items = [
        { btnId: 'google-bookmark', winClass: '.google-folder-window' },
        { btnId: 'hanu-bookmark', winClass: '.hanu-folder-window' },
        { btnId: 'study-bookmark', winClass: '.study-folder-window' }
    ];

    // Lưu trữ tham chiếu các element thực tế để dùng sau này
    const elements = items.map(item => ({
        btn: document.getElementById(item.btnId),
        win: document.querySelector(item.winClass)
    })).filter(el => el.btn && el.win); // Chỉ lấy những cặp tồn tại để tránh lỗi null

    // 2. Hàm đóng tất cả các cửa sổ (trừ cái đang được click - tùy chọn)
    function closeAllWindows(exceptWindow = null) {
        elements.forEach(el => {
            if (el.win !== exceptWindow) {
                el.win.classList.remove('active');
            }
        });
    }

    // 3. Gán sự kiện click cho từng nút
    elements.forEach(el => {
        el.btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Ngăn sự kiện nổi bọt
            
            // Bước quan trọng: Kiểm tra trạng thái hiện tại
            const isCurrentlyActive = el.win.classList.contains('active');

            // Đóng TẤT CẢ các cửa sổ khác trước
            closeAllWindows(el.win);

            // Toggle cửa sổ hiện tại
            // Nếu nó đang mở -> đóng lại (remove active)
            // Nếu nó đang đóng -> mở ra (add active)
            // Tuy nhiên vì ở trên ta đã chạy closeAllWindows(el.win) nên el.win vẫn giữ nguyên trạng thái cũ
            // Giờ ta chỉ việc đảo ngược trạng thái:
            
            if (isCurrentlyActive) {
                el.win.classList.remove('active');
            } else {
                el.win.classList.add('active');
            }
        });
    });

    // 4. Xử lý click ra ngoài (Chỉ cần 1 sự kiện chung cho cả trang)
    document.addEventListener('click', (e) => {
        // Kiểm tra xem click có trúng vào bất kỳ nút hay cửa sổ nào không
        let isClickInsideAny = false;
        
        elements.forEach(el => {
            if (el.btn.contains(e.target) || el.win.contains(e.target)) {
                isClickInsideAny = true;
            }
        });

        // Nếu click ra ngoài vùng an toàn, đóng tất cả
        if (!isClickInsideAny) {
            closeAllWindows();
        }
    });
});