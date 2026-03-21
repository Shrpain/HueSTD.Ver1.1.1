import React, { useState, useRef } from 'react';
import { X, User, GraduationCap, BookOpen, Camera, Save, Loader2, Upload, ImagePlus } from 'lucide-react';
import { useAuth, UpdateProfileData } from '../context/AuthContext';
import api from '../services/api';
import { HUE_UNIVERSITIES } from '../constants';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: {
        name: string;
        school: string;
        major: string;
        avatar: string;
    };
    onProfileUpdated?: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, currentUser, onProfileUpdated }) => {
    const { updateUser, refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [fullName, setFullName] = useState(currentUser.name);
    const [school, setSchool] = useState(currentUser.school);
    const [major, setMajor] = useState(currentUser.major);
    const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar);
    const [avatarPreview, setAvatarPreview] = useState(currentUser.avatar);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setError('Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('File quá lớn. Tối đa 5MB');
            return;
        }

        // Show preview immediately
        const reader = new FileReader();
        reader.onload = (e) => {
            setAvatarPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Upload file
        setUploadingAvatar(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post('/Profile/upload-avatar', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.avatarUrl) {
                setAvatarUrl(response.data.avatarUrl);
                setAvatarPreview(response.data.avatarUrl);
                setSuccess('Ảnh đại diện đã được cập nhật!');

                // Refresh user data via AJAX
                await refreshUser();

                // Notify parent to update UI
                if (onProfileUpdated) {
                    onProfileUpdated();
                }
            }
        } catch (err: any) {
            console.error('Upload failed:', err);
            setError(err.response?.data?.message || 'Upload thất bại');
            // Revert preview
            setAvatarPreview(currentUser.avatar);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        const data: UpdateProfileData = {
            fullName: fullName !== currentUser.name ? fullName : undefined,
            school: school !== currentUser.school ? school : undefined,
            major: major !== currentUser.major ? major : undefined,
            // Avatar is handled separately via upload
        };

        // Only send if something changed
        if (!data.fullName && !data.school && !data.major) {
            setError('Không có thay đổi nào');
            setLoading(false);
            return;
        }

        const result = await updateUser(data);

        if (result) {
            setSuccess('Cập nhật thành công!');

            // Refresh user data via AJAX (no page reload)
            await refreshUser();

            // Notify parent to update UI
            if (onProfileUpdated) {
                onProfileUpdated();
            }

            setTimeout(() => {
                onClose();
            }, 1000);
        } else {
            setError('Cập nhật thất bại, vui lòng thử lại');
        }

        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                <div className="absolute top-6 right-6 z-10">
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 md:p-10">
                    <div className="text-center space-y-2 mb-8">
                        <div className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white font-black mx-auto shadow-xl shadow-teal-100 mb-4">
                            <User size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800">Chỉnh sửa hồ sơ</h2>
                        <p className="text-slate-500 font-medium text-sm">Cập nhật thông tin cá nhân của bạn</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium text-center">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm font-medium text-center">
                                {success}
                            </div>
                        )}

                        {/* Avatar Upload Section */}
                        <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-200 border-4 border-white shadow-lg">
                                    {uploadingAvatar ? (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                            <Loader2 size={28} className="animate-spin text-teal-600" />
                                        </div>
                                    ) : (
                                        <img
                                            src={avatarPreview || 'https://ui-avatars.com/api/?name=User&background=0d9488&color=fff&size=200'}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=User&background=0d9488&color=fff&size=200';
                                            }}
                                        />
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingAvatar}
                                    className="absolute -bottom-2 -right-2 p-2 bg-teal-600 text-white rounded-xl shadow-lg hover:bg-teal-700 transition-all border-2 border-white disabled:opacity-50"
                                >
                                    <Camera size={16} />
                                </button>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingAvatar}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                            >
                                {uploadingAvatar ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Đang tải lên...
                                    </>
                                ) : (
                                    <>
                                        <ImagePlus size={16} />
                                        Tải ảnh từ thiết bị
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-slate-400 text-center">JPEG, PNG, GIF, WebP • Tối đa 5MB</p>
                        </div>

                        {/* Full Name */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Họ và tên</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Nguyễn Văn A"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                                />
                            </div>
                        </div>

                        {/* School */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Trường đại học</label>
                            <div className="relative">
                                <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <select
                                    value={school}
                                    onChange={(e) => setSchool(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none appearance-none text-slate-700"
                                >
                                    <option value="">Chọn trường</option>
                                    {HUE_UNIVERSITIES.map((univ) => (
                                        <option key={univ} value={univ}>{univ}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Major */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Chuyên ngành</label>
                            <div className="relative">
                                <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Công nghệ thông tin"
                                    value={major}
                                    onChange={(e) => setMajor(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || uploadingAvatar}
                            className="w-full bg-teal-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group active:scale-95 mt-6"
                        >
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    <Save size={18} />
                                    Lưu thay đổi
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditProfileModal;
