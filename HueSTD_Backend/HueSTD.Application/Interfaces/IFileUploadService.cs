namespace HueSTD.Application.Interfaces;

public interface IFileUploadService
{
    /// <summary>
    /// Upload một file và trả về URL công khai.
    /// </summary>
    /// <param name="file">File stream</param>
    /// <param name="fileName">Tên file gốc (để lưu phần mở rộng)</param>
    /// <param name="userId">Id người dùng để phân lớp thư mục</param>
    /// <returns>URL công khai và tên file lưu trong storage</returns>
    Task<(string fileUrl, string storedFileName)> UploadAsync(System.IO.Stream file, string fileName, string userId);
}
