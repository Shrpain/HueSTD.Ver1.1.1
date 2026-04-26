using HueSTD.Application.DTOs.Exam;

namespace HueSTD.Application.Interfaces;

public interface IExamService
{
    Task<IEnumerable<ExamDto>> GetMyExamsAsync(Guid userId);
    Task<ExamDto> GetExamByIdAsync(Guid id, Guid userId);
    Task<ExamDto> CreateManualExamAsync(ExamDto examDto, Guid userId);
    Task<ExamDto> UpdateManualExamAsync(Guid id, ExamDto examDto, Guid userId);
    Task<bool> DeleteExamAsync(Guid id, Guid userId);
}
