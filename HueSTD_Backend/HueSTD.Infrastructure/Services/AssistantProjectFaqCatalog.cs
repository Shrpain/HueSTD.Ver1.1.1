using System.Globalization;
using System.Text;

namespace HueSTD.Infrastructure.Services;

internal static class AssistantProjectFaqCatalog
{
    public static bool TryMatch(string message, string? module, out string response)
    {
        var text = Normalize(message);
        var currentModule = Normalize(module);

        if (ContainsAny(text, "huestd la gi", "he thong nay la gi", "nen tang nay la gi"))
        {
            response =
                "HueSTD là nền tảng cộng đồng sinh viên Huế.\n" +
                "- Chia sẻ tài liệu học tập\n" +
                "- Nhắn tin trao đổi giữa sinh viên\n" +
                "- Sử dụng AI để trợ giúp học tập\n" +
                "- Tài liệu được kiểm duyệt bởi admin";
            return true;
        }

        if (ContainsAny(text, "ban lam duoc gi", "assistant lam duoc gi", "tro ly lam duoc gi"))
        {
            response =
                "Tôi có thể hỗ trợ trong phạm vi HueSTD.\n" +
                "- Giải thích chức năng của từng module\n" +
                "- Gợi ý cách tìm, đăng và theo dõi tài liệu\n" +
                "- Hướng dẫn dùng chat, thông báo, hồ sơ\n" +
                "- Tìm tài liệu liên quan trong dữ liệu HueSTD";
            return true;
        }

        if (ContainsAny(text, "trang nay lam gi", "module nay lam gi", "chuc nang nay la gi"))
        {
            response = BuildModuleOverview(currentModule);
            return true;
        }

        if (ContainsAny(text, "lam sao tim tai lieu", "tim tai lieu nhu the nao", "cach tim tai lieu"))
        {
            response =
                "Bạn có thể tìm tài liệu ngay trong module Tài liệu.\n" +
                "- Gõ tên tài liệu hoặc môn học vào ô tìm kiếm\n" +
                "- Lọc theo loại tài liệu và trường\n" +
                "- Mở chi tiết để xem, bình luận hoặc tải về";
            return true;
        }

        if (ContainsAny(text, "lam sao dang tai lieu", "lam sao tai len tai lieu", "dong gop tai lieu"))
        {
            response =
                "Để đóng góp tài liệu trên HueSTD:\n" +
                "1. Đăng nhập tài khoản.\n" +
                "2. Mở module Tài liệu và chọn `Đóng góp tài liệu`.\n" +
                "3. Tải file lên, điền thông tin mô tả rồi gửi duyệt.";
            return true;
        }

        if (ContainsAny(text, "tai lieu co can duyet", "tai lieu co phai duyet", "dang tai lieu co can admin duyet"))
        {
            response =
                "Có. Tài liệu người dùng đóng góp sẽ đi qua bước kiểm duyệt.\n" +
                "- Admin nhận thông báo có tài liệu mới cần duyệt\n" +
                "- Người đăng cũng nhận thông báo rằng tài liệu đang chờ xét duyệt";
            return true;
        }

        if (ContainsAny(text, "co can dang nhap de dang tai lieu", "phai dang nhap moi dang tai lieu", "dang tai lieu co can dang nhap"))
        {
            response = "Có. Bạn cần đăng nhập để đóng góp tài liệu, bình luận và dùng các chức năng cá nhân hóa.";
            return true;
        }

        if (ContainsAny(text, "chat dung de lam gi", "nhan tin nhu the nao", "gui tin nhan cho nguoi khac"))
        {
            response =
                "Module Chat cho phép nhắn tin trực tiếp giữa người dùng HueSTD.\n" +
                "- Xem danh sách cuộc trò chuyện\n" +
                "- Tạo cuộc trò chuyện mới với người dùng khác\n" +
                "- Nhắn tin realtime và đánh dấu đã đọc";
            return true;
        }

        if (ContainsAny(text, "bao cao tin nhan", "report tin nhan", "bao cao chat"))
        {
            response =
                "Bạn có thể báo cáo tin nhắn trong module Chat.\n" +
                "- Gửi báo cáo tới admin để kiểm duyệt\n" +
                "- Admin sẽ nhận thông báo về nội dung bị báo cáo";
            return true;
        }

        if (ContainsAny(text, "thong bao de lam gi", "module thong bao", "xem thong bao o dau"))
        {
            response =
                "Module Thông báo dùng để theo dõi các cập nhật cá nhân trong hệ thống.\n" +
                "- Xem danh sách thông báo\n" +
                "- Đếm số thông báo chưa đọc\n" +
                "- Đánh dấu đã đọc hoặc xóa thông báo";
            return true;
        }

        if (ContainsAny(text, "ho so lam duoc gi", "profile lam duoc gi", "trang ca nhan lam duoc gi"))
        {
            response =
                "Module Hồ sơ giúp bạn quản lý thông tin cá nhân trên HueSTD.\n" +
                "- Xem thông tin tài khoản hiện tại\n" +
                "- Cập nhật hồ sơ và ảnh đại diện\n" +
                "- Xem tài liệu bạn đã đăng";
            return true;
        }

        if (ContainsAny(text, "admin lam duoc gi", "trang admin lam duoc gi", "quan tri co gi"))
        {
            response =
                "Khu vực Admin dùng để vận hành hệ thống.\n" +
                "- Duyệt hoặc từ chối tài liệu\n" +
                "- Quản lý người dùng và cài đặt\n" +
                "- Gửi thông báo hệ thống tới người dùng";
            return true;
        }

        if (ContainsAny(text, "dashboard co gi", "trang chu co gi", "dashboard lam duoc gi"))
        {
            response =
                "Dashboard là trang tổng quan của HueSTD.\n" +
                "- Hiển thị thống kê toàn hệ thống\n" +
                "- Theo dõi tài liệu nổi bật theo tuần\n" +
                "- Cập nhật realtime khi dữ liệu tài liệu hoặc thành viên thay đổi";
            return true;
        }

        response = string.Empty;
        return false;
    }

    private static string BuildModuleOverview(string module)
    {
        return module switch
        {
            "documents" => "Trang này là module Tài liệu.\n- Xem danh sách tài liệu đã duyệt\n- Tìm kiếm theo tên môn hoặc tiêu đề\n- Lọc theo trường và loại tài liệu",
            "chat" => "Trang này là module Chat.\n- Xem cuộc trò chuyện hiện có\n- Nhắn tin realtime với người dùng khác\n- Theo dõi trạng thái đã đọc và cập nhật mới",
            "notification" or "notifications" => "Trang này là module Thông báo.\n- Xem thông báo hệ thống và cá nhân\n- Theo dõi mục chưa đọc\n- Đánh dấu đã đọc hoặc xóa thông báo",
            "profile" => "Trang này là module Hồ sơ.\n- Xem thông tin tài khoản\n- Cập nhật ảnh đại diện và hồ sơ\n- Xem tài liệu bạn đã đăng",
            "dashboard" => "Trang này là Dashboard.\n- Xem thống kê tổng quan\n- Theo dõi tài liệu nổi bật\n- Xem bảng xếp hạng và dữ liệu realtime",
            "admin" => "Trang này là khu vực Admin.\n- Duyệt tài liệu và quản lý người dùng\n- Gửi thông báo hệ thống\n- Theo dõi hoạt động quản trị",
            _ => "Đây là một phần của hệ thống HueSTD. Bạn có thể hỏi cụ thể hơn như `trang tài liệu làm gì`, `làm sao đăng tài liệu`, `module chat dùng thế nào`."
        };
    }

    private static bool ContainsAny(string text, params string[] phrases)
    {
        return phrases.Any(text.Contains);
    }

    private static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var decomposed = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);

        foreach (var ch in decomposed)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            builder.Append(ch switch
            {
                'đ' => 'd',
                _ => ch
            });
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}
