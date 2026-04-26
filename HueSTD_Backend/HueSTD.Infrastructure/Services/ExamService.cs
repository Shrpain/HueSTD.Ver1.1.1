using HueSTD.Application.DTOs.Exam;
using HueSTD.Application.Interfaces;
using Supabase;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Supabase.Postgrest;

namespace HueSTD.Infrastructure.Services;

public class ExamService : IExamService
{
    private readonly Supabase.Client _supabaseClient;

    public ExamService(Supabase.Client supabaseClient)
    {
        _supabaseClient = supabaseClient;
    }

    public async Task<IEnumerable<ExamDto>> GetMyExamsAsync(Guid userId)
    {
        var response = await _supabaseClient.From<HueSTD.Domain.Entities.Exam>()
            .Where(x => x.UserId == userId)
            .Order(x => x.CreatedAt, Constants.Ordering.Descending)
            .Get();

        return response.Models.Select(MapToDto);
    }

    public async Task<ExamDto> GetExamByIdAsync(Guid id, Guid userId)
    {
        var response = await _supabaseClient.From<HueSTD.Domain.Entities.Exam>()
            .Where(x => x.Id == id && x.UserId == userId)
            .Single();

        if (response == null) return null!;

        var questionsResponse = await _supabaseClient.From<HueSTD.Domain.Entities.ExamQuestion>()
            .Where(x => x.ExamId == id)
            .Order(x => x.OrderIndex, Constants.Ordering.Ascending)
            .Get();

        var examDto = MapToDto(response);

        foreach (var q in questionsResponse.Models)
        {
            var optionsResponse = await _supabaseClient.From<HueSTD.Domain.Entities.ExamOption>()
                .Where(x => x.QuestionId == q.Id)
                .Get();

            examDto.Questions.Add(new ExamQuestionDto
            {
                Id = q.Id,
                Text = q.Text,
                Points = q.Points,
                Options = optionsResponse.Models.Select(o => new ExamOptionDto
                {
                    Id = o.Id,
                    Key = o.OptionKey,
                    Text = o.Text,
                    IsCorrect = o.IsCorrect
                }).ToList()
            });
        }

        return examDto;
    }

    public async Task<ExamDto> CreateManualExamAsync(ExamDto examDto, Guid userId)
    {
        // 1. Save Exam
        var exam = new HueSTD.Domain.Entities.Exam
        {
            UserId = userId,
            Title = examDto.Title,
            Description = examDto.Description,
            DurationMinutes = examDto.DurationMinutes,
            Status = "draft" // Always draft for personal vault
        };

        var examResponse = await _supabaseClient.From<HueSTD.Domain.Entities.Exam>().Insert(exam);
        var savedExam = examResponse.Models.First();

        // 2. Save Questions & Options
        for (int i = 0; i < examDto.Questions.Count; i++)
        {
            var qDto = examDto.Questions[i];
            var question = new HueSTD.Domain.Entities.ExamQuestion
            {
                ExamId = savedExam.Id,
                Text = qDto.Text,
                Points = qDto.Points,
                OrderIndex = i
            };

            var qResponse = await _supabaseClient.From<HueSTD.Domain.Entities.ExamQuestion>().Insert(question);
            var savedQuestion = qResponse.Models.First();

            var options = qDto.Options.Select(o => new HueSTD.Domain.Entities.ExamOption
            {
                QuestionId = savedQuestion.Id,
                OptionKey = o.Key,
                Text = o.Text,
                IsCorrect = o.IsCorrect
            }).ToList();

            await _supabaseClient.From<HueSTD.Domain.Entities.ExamOption>().Insert(options);
        }

        examDto.Id = savedExam.Id;
        return examDto;
    }

    public async Task<ExamDto> UpdateManualExamAsync(Guid id, ExamDto examDto, Guid userId)
    {
        // 1. Check existence and ownership
        var existing = await _supabaseClient.From<HueSTD.Domain.Entities.Exam>()
            .Where(x => x.Id == id && x.UserId == userId)
            .Single();

        if (existing == null) return null!;

        // 2. Update Exam info
        existing.Title = examDto.Title;
        existing.Description = examDto.Description;
        existing.DurationMinutes = examDto.DurationMinutes;
        existing.UpdatedAt = DateTime.UtcNow;

        await _supabaseClient.From<HueSTD.Domain.Entities.Exam>().Update(existing);

        // 3. Delete old questions (cascade will delete options)
        await _supabaseClient.From<HueSTD.Domain.Entities.ExamQuestion>()
            .Where(x => x.ExamId == id)
            .Delete();

        // 4. Insert new questions & options
        for (int i = 0; i < examDto.Questions.Count; i++)
        {
            var qDto = examDto.Questions[i];
            var question = new HueSTD.Domain.Entities.ExamQuestion
            {
                ExamId = id,
                Text = qDto.Text,
                Points = qDto.Points,
                OrderIndex = i,
                CreatedAt = DateTime.UtcNow
            };

            var qResponse = await _supabaseClient.From<HueSTD.Domain.Entities.ExamQuestion>().Insert(question);
            var savedQuestion = qResponse.Models.First();

            var options = qDto.Options.Select(o => new HueSTD.Domain.Entities.ExamOption
            {
                QuestionId = savedQuestion.Id,
                OptionKey = o.Key,
                Text = o.Text,
                IsCorrect = o.IsCorrect,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            await _supabaseClient.From<HueSTD.Domain.Entities.ExamOption>().Insert(options);
        }

        return examDto;
    }

    public async Task<bool> DeleteExamAsync(Guid id, Guid userId)
    {
        var existing = await _supabaseClient.From<HueSTD.Domain.Entities.Exam>()
            .Where(x => x.Id == id && x.UserId == userId)
            .Single();

        if (existing == null)
        {
            return false;
        }

        await _supabaseClient.From<HueSTD.Domain.Entities.Exam>()
            .Where(x => x.Id == id && x.UserId == userId)
            .Delete();

        return true;
    }

    private ExamDto MapToDto(HueSTD.Domain.Entities.Exam model)
    {
        return new ExamDto
        {
            Id = model.Id,
            Title = model.Title,
            Description = model.Description,
            DurationMinutes = model.DurationMinutes,
            Status = model.Status,
            CreatedAt = model.CreatedAt,
            Questions = new List<ExamQuestionDto>()
        };
    }
}
