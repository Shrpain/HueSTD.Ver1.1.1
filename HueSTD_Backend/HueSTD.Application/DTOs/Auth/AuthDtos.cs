using System.ComponentModel.DataAnnotations;

namespace HueSTD.Application.DTOs.Auth;

public class RegisterRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    public required string Email { get; set; }

    [Required(ErrorMessage = "Password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$", ErrorMessage = "Password must contain at least one uppercase letter, one lowercase letter, and one number")]
    public required string Password { get; set; }

    [StringLength(100, ErrorMessage = "FullName cannot exceed 100 characters")]
    public string? FullName { get; set; }

    [StringLength(200, ErrorMessage = "School cannot exceed 200 characters")]
    public string? School { get; set; }
}

public class LoginRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    public required string Email { get; set; }

    [Required(ErrorMessage = "Password is required")]
    public required string Password { get; set; }
}

public class AuthResponse
{
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public UserDto? User { get; set; }
}

public class UserDto
{
    public string? Id { get; set; }
    public string? Email { get; set; }
    public string? FullName { get; set; }
    public string Role { get; set; } = "user";
    public string? School { get; set; }
    public string? Major { get; set; }
    public string? AvatarUrl { get; set; }
    public int Points { get; set; }
    public int Rank { get; set; }
    public string? Badge { get; set; }
    public string? PublicId { get; set; }
    public int TotalDocuments { get; set; }
    public int TotalDownloads { get; set; }
    public double AverageRating { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UpdateProfileRequest
{
    [StringLength(100, ErrorMessage = "FullName cannot exceed 100 characters")]
    public string? FullName { get; set; }

    [StringLength(200, ErrorMessage = "School cannot exceed 200 characters")]
    public string? School { get; set; }

    [StringLength(100, ErrorMessage = "Major cannot exceed 100 characters")]
    public string? Major { get; set; }

    [Url(ErrorMessage = "Invalid avatar URL format")]
    public string? AvatarUrl { get; set; }
}
