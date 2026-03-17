import React, { useState, useEffect, Component, ReactNode, ErrorInfo } from 'react';
import { 
  Upload as UploadIcon, 
  Download, 
  LogIn, 
  LogOut, 
  FileText, 
  Users, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle,
  AlertTriangle,
  Plus,
  Archive,
  Shield,
  Trash2,
  Key,
  Settings,
  BarChart3,
  Database,
  Clock,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Assignment {
  id: number;
  name: string;
  target_classes: string[];
}

interface UploadData {
  id: number;
  student_name: string;
  student_class: string;
  assignment_id: number;
  assignment_name: string;
  original_filename: string;
  server_filename: string;
  upload_date: string;
}

interface TeacherProfile {
  id: number;
  username: string;
  classes: string[];
  isAdmin: boolean;
}

interface Teacher {
  id: number;
  username: string;
  classes: string[];
  isAdmin: boolean;
}

// --- Components ---

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'accent' | 'ghost' }) => {
  const variants = {
    primary: 'bg-[#454c9b] text-white hover:bg-[#363b7a]',
    secondary: 'bg-[#cfd600] text-[#454c9b] hover:bg-[#b8be00]',
    accent: 'bg-[#f25ca3] text-white hover:bg-[#d94a8d]',
    ghost: 'bg-transparent text-[#454c9b] hover:bg-black/5'
  };
  
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn(
      'w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#454c9b] focus:border-transparent transition-all',
      className
    )}
    {...props}
  />
);

const Select = ({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select 
    className={cn(
      'w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#454c9b] focus:border-transparent transition-all bg-white',
      className
    )}
    {...props}
  >
    {children}
  </select>
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden', className)}>
    {children}
  </div>
);

// --- Main App ---

async function safeFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    return { ok: res.ok, data, status: res.status };
  }
  
  if (!res.ok) {
    return { ok: false, data: { error: `Server fout (${res.status})` }, status: res.status };
  }
  
  return { ok: true, data: null, status: res.status };
}

export default function App() {
  const [view, setView] = useState<'landing' | 'student' | 'teacher-login' | 'teacher-dashboard' | 'admin-dashboard'>('landing');
  const [isRegistering, setIsRegistering] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [globalClasses, setGlobalClasses] = useState<string[]>([]);
  const [uploads, setUploads] = useState<UploadData[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number, name: string, hasUploads: boolean } | null>(null);
  const [uploadReceipt, setUploadReceipt] = useState<{
    studentName: string;
    studentClass: string;
    assignmentName: string;
    fileName: string;
    date: string;
  } | null>(null);

  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');

  // Student Form State
  const [studentName, setStudentName] = useState('');
  const [studentTeacherId, setStudentTeacherId] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [publicTeachers, setPublicTeachers] = useState<{ id: number, username: string }[]>([]);

  // Teacher Dashboard State
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [selectedClassAssignments, setSelectedClassAssignments] = useState<Record<string, string>>({});

  // New Assignment State
  const [newAssignmentName, setNewAssignmentName] = useState('');
  const [newAssignmentClasses, setNewAssignmentClasses] = useState<string[]>([]);

  // Admin State
  const [newTeacherUsername, setNewTeacherUsername] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const [newTeacherClasses, setNewTeacherClasses] = useState('');
  const [newTeacherIsAdmin, setNewTeacherIsAdmin] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [isAddingNewClass, setIsAddingNewClass] = useState(false);
  const [selectedGlobalClass, setSelectedGlobalClass] = useState('');
  
  const [adminStats, setAdminStats] = useState<any>(null);
  const [allUploads, setAllUploads] = useState<any[]>([]);
  const [adminSettings, setAdminSettings] = useState<any>(null);
  const [adminTab, setAdminTab] = useState<'teachers' | 'stats' | 'uploads' | 'settings'>('teachers');
  const [cleanupMonths, setCleanupMonths] = useState('12');

  useEffect(() => {
    checkAuth();
    fetchClasses();
    fetchPublicTeachers();
  }, []);

  const fetchPublicTeachers = async () => {
    try {
      const { ok, data } = await safeFetch('/api/teachers/public');
      if (ok) {
        setPublicTeachers(data);
      }
    } catch (e) {
      console.error('Fetch public teachers failed', e);
    }
  };

  useEffect(() => {
    if (teacherProfile) {
      fetchUploads();
      fetchAssignments();
      fetchClasses();
      fetchGlobalClasses();
      if (teacherProfile.isAdmin) {
        fetchTeachers();
        fetchAdminStats();
        fetchAllUploads();
        fetchAdminSettings();
      }
    }
  }, [teacherProfile]);

  useEffect(() => {
    if (teacherProfile && teacherProfile.isAdmin && view === 'admin-dashboard') {
      fetchTeachers();
    }
  }, [teacherProfile, view]);

  const checkAuth = async () => {
    try {
      const { ok, data } = await safeFetch('/api/me', { credentials: 'include' });
      if (ok) {
        setTeacherProfile(data);
        // Do not automatically set view to dashboard, stay on landing
      }
    } catch (e) {
      console.error('Auth check failed', e);
    } finally {
      setIsReady(true);
    }
  };

  const fetchAssignments = async (studentClass?: string, teacherId?: string) => {
    try {
      let url = '/api/assignments';
      const params = new URLSearchParams();
      if (studentClass) params.append('studentClass', studentClass);
      if (teacherId) params.append('teacherId', teacherId);
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const { ok, data } = await safeFetch(url, { credentials: 'include' });
      if (ok) {
        setAssignments(data);
      }
    } catch (e) {
      console.error('Fetch assignments failed', e);
    }
  };

  const fetchClasses = async (teacherId?: string) => {
    try {
      const url = teacherId ? `/api/classes?teacherId=${teacherId}` : '/api/classes';
      const { ok, data } = await safeFetch(url, { credentials: 'include' });
      if (ok) {
        setAvailableClasses(data);
      }
    } catch (e) {
      console.error('Fetch classes failed', e);
    }
  };

  const fetchGlobalClasses = async () => {
    try {
      const { ok, data } = await safeFetch('/api/classes/global', { credentials: 'include' });
      if (ok) {
        setGlobalClasses(data);
      }
    } catch (e) {
      console.error('Fetch global classes failed', e);
    }
  };

  const fetchUploads = async () => {
    try {
      const { ok, data } = await safeFetch('/api/uploads', { credentials: 'include' });
      if (ok) {
        setUploads(data);
      }
    } catch (e) {
      console.error('Fetch uploads failed', e);
    }
  };

  const fetchTeachers = async () => {
    try {
      const { ok, data } = await safeFetch('/api/admin/teachers', { credentials: 'include' });
      if (ok) {
        setTeachers(data);
      }
    } catch (e) {
      console.error('Fetch teachers failed', e);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const { ok, data } = await safeFetch('/api/admin/stats', { credentials: 'include' });
      if (ok) setAdminStats(data);
    } catch (e) {
      console.error('Fetch stats failed', e);
    }
  };

  const fetchAllUploads = async () => {
    try {
      const { ok, data } = await safeFetch('/api/admin/all-uploads', { credentials: 'include' });
      if (ok) setAllUploads(data);
    } catch (e) {
      console.error('Fetch all uploads failed', e);
    }
  };

  const fetchAdminSettings = async () => {
    try {
      const { ok, data } = await safeFetch('/api/admin/settings', { credentials: 'include' });
      if (ok) setAdminSettings(data);
    } catch (e) {
      console.error('Fetch settings failed', e);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok } = await safeFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminSettings),
        credentials: 'include'
      });
      if (ok) {
        setMessage({ type: 'success', text: 'Instellingen opgeslagen' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Fout bij opslaan instellingen' });
    } finally {
      setLoading(false);
    }
  };

  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  const handleCleanup = async () => {
    if (!showCleanupConfirm) {
      setShowCleanupConfirm(true);
      return;
    }
    
    setLoading(true);
    try {
      const { ok, data } = await safeFetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: parseInt(cleanupMonths) }),
        credentials: 'include'
      });
      if (ok) {
        const count = data.count || 0;
        setMessage({ 
          type: 'success', 
          text: count === 0 ? 'Geen bestanden gevonden om te verwijderen' : `${count} bestanden succesvol verwijderd` 
        });
        fetchAdminStats();
        fetchAllUploads();
        setShowCleanupConfirm(false);
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Fout bij opschonen' });
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok, data } = await safeFetch('/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: newTeacherUsername, 
          password: newTeacherPassword, 
          isAdmin: newTeacherIsAdmin 
        }),
        credentials: 'include'
      });

      if (ok) {
        setNewTeacherUsername('');
        setNewTeacherPassword('');
        setNewTeacherIsAdmin(false);
        setMessage({ type: 'success', text: 'Docent account aangemaakt!' });
        fetchTeachers();
      } else {
        throw new Error(data?.error || 'Fout bij aanmaken');
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (teacherId: number) => {
    if (!newPassword) return;
    setLoading(true);
    try {
      const { ok, data } = await safeFetch(`/api/admin/teachers/${teacherId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
        credentials: 'include'
      });

      if (ok) {
        setNewPassword('');
        setEditingTeacherId(null);
        setMessage({ type: 'success', text: 'Wachtwoord gewijzigd!' });
      } else {
        throw new Error(data?.error || 'Fout bij wijzigen');
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: number) => {
    setLoading(true);
    try {
      const { ok, data } = await safeFetch(`/api/admin/teachers/${teacherId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (ok) {
        setMessage({ type: 'success', text: 'Docent verwijderd!' });
        fetchTeachers();
      } else {
        throw new Error(data?.error || 'Fout bij verwijderen');
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const className = isAddingNewClass ? newClassName : selectedGlobalClass;
    if (!className) return;
    
    setLoading(true);
    try {
      const { ok, data } = await safeFetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: className }),
        credentials: 'include'
      });

      if (ok) {
        setNewClassName('');
        setSelectedGlobalClass('');
        setIsAddingNewClass(false);
        setMessage({ type: 'success', text: 'Klas gekoppeld!' });
        fetchClasses();
        fetchGlobalClasses();
      } else {
        throw new Error(data?.error || 'Fout bij koppelen');
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (className: string) => {
    setLoading(true);
    try {
      const { ok, data } = await safeFetch(`/api/classes/${className}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (ok) {
        setMessage({ type: 'success', text: 'Klas verwijderd!' });
        fetchClasses();
      } else {
        throw new Error(data?.error || 'Fout bij verwijderen');
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleStudentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedAssignment) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('student_name', studentName);
      formData.append('student_class', studentClass);
      formData.append('assignment_id', selectedAssignment);
      formData.append('file', selectedFile);

      const { ok, data } = await safeFetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (ok) {
        const assignment = assignments.find(a => a.id.toString() === selectedAssignment);
        setUploadReceipt({
          studentName,
          studentClass,
          assignmentName: assignment?.name || 'Onbekende opdracht',
          fileName: selectedFile.name,
          date: new Date().toLocaleString('nl-NL')
        });
        
        setStudentName('');
        setStudentClass('');
        setSelectedAssignment('');
        setSelectedFile(null);
      } else {
        throw new Error(data?.error || 'Upload mislukt');
      }
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: 'Er is een fout opgetreden bij het uploaden: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok, data } = await safeFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
        credentials: 'include'
      });

      if (ok) {
        setTeacherProfile(data);
        setView(data.isAdmin ? 'admin-dashboard' : 'teacher-dashboard');
        setLoginUsername('');
        setLoginPassword('');
      } else {
        throw new Error(data?.error || 'Inloggen mislukt');
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok, data } = await safeFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: loginUsername, 
          password: loginPassword, 
          registrationCode 
        }),
        credentials: 'include'
      });

      if (ok) {
        setMessage({ type: 'success', text: 'Account aangemaakt! Je kunt nu inloggen.' });
        setIsRegistering(false);
        setRegistrationCode('');
      } else {
        throw new Error(data?.error || 'Registratie mislukt');
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await safeFetch('/api/logout', { method: 'POST', credentials: 'include' });
    setTeacherProfile(null);
    setView('landing');
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok, data } = await safeFetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newAssignmentName,
          target_classes: newAssignmentClasses
        }),
        credentials: 'include'
      });

      if (ok) {
        setNewAssignmentName('');
        setNewAssignmentClasses([]);
        setMessage({ type: 'success', text: 'Opdracht aangemaakt!' });
        fetchAssignments();
      } else {
        throw new Error(data?.error || 'Fout bij aanmaken');
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) return;

    const hasUploads = uploads.some(u => u.assignment_id === id);
    setDeleteConfirm({ id, name: assignment.name, hasUploads });
  };

  const confirmDeleteAssignment = async () => {
    if (!deleteConfirm) return;
    
    setLoading(true);
    try {
      const { ok, data } = await safeFetch(`/api/assignments/${deleteConfirm.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (ok) {
        setMessage({ type: 'success', text: 'Opdracht en bijbehorende bestanden verwijderd!' });
        setDeleteConfirm(null);
        fetchAssignments();
        fetchUploads();
      } else {
        throw new Error(data?.error || 'Fout bij verwijderen');
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (id: number) => {
    window.open(`/api/download/${id}`, '_blank');
  };

  const downloadZip = (studentClass: string, assignmentId: number) => {
    window.open(`/api/download-zip/${studentClass}/${assignmentId}`, '_blank');
  };

  const filteredUploads = uploads.filter(u => {
    const matchesSearch = u.student_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = classFilter === 'all' || u.student_class === classFilter;
    const matchesAssignment = assignmentFilter === 'all' || u.assignment_id.toString() === assignmentFilter;
    return matchesSearch && matchesClass && matchesAssignment;
  });

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#454c9b]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-['Kiro',sans-serif] text-gray-800">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-gray-100"
            >
              <div className="flex items-center gap-4 mb-6 text-red-500">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-2xl font-['Staatliches',sans-serif]">Opdracht verwijderen?</h3>
              </div>
              
              <div className="space-y-4 mb-8">
                <p className="text-gray-600">
                  Weet je zeker dat je de opdracht <span className="font-bold text-gray-900">"{deleteConfirm.name}"</span> wilt verwijderen?
                </p>
                
                {deleteConfirm.hasUploads && (
                  <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex gap-3">
                    <AlertCircle className="text-orange-500 shrink-0" size={20} />
                    <p className="text-sm text-orange-800 font-medium">
                      Let op: Er zijn al bestanden ingeleverd voor deze opdracht. Als je doorgaat, worden deze bestanden ook definitief verwijderd!
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="secondary" 
                  className="flex-1" 
                  onClick={() => setDeleteConfirm(null)}
                  disabled={loading}
                >
                  Annuleren
                </Button>
                <Button 
                  className="flex-1 bg-red-500 hover:bg-red-600 border-red-500 text-white" 
                  onClick={confirmDeleteAssignment}
                  disabled={loading}
                >
                  {loading ? 'Bezig...' : 'Ja, verwijderen'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="bg-[#454c9b] text-white py-6 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => setView(teacherProfile ? (teacherProfile.isAdmin ? 'admin-dashboard' : 'teacher-dashboard') : 'landing')}
          >
            <div className="w-10 h-10 bg-[#cfd600] rounded-full flex items-center justify-center">
              <Archive className="text-[#454c9b] w-6 h-6" />
            </div>
            <h1 className="text-2xl font-['Staatliches',sans-serif] tracking-wider">Xerte File Manager</h1>
          </div>
          <nav className="flex gap-4">
            {view !== 'landing' && !teacherProfile && (
              <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setView('landing')}>
                Home
              </Button>
            )}
            {teacherProfile?.isAdmin && (
              <Button 
                variant={view === 'admin-dashboard' ? 'secondary' : 'ghost'} 
                className={view === 'admin-dashboard' ? '' : 'text-white hover:bg-white/10'}
                onClick={() => setView('admin-dashboard')}
              >
                <Shield size={18} /> Beheer
              </Button>
            )}
            {teacherProfile && (
              <Button 
                variant={view === 'teacher-dashboard' ? 'secondary' : 'ghost'} 
                className={view === 'teacher-dashboard' ? '' : 'text-white hover:bg-white/10'}
                onClick={() => setView('teacher-dashboard')}
              >
                <Users size={18} /> Dashboard
              </Button>
            )}
            {!teacherProfile ? (
              <Button variant="secondary" onClick={() => setView('teacher-login')}>
                <LogIn size={18} /> Inloggen
              </Button>
            ) : (
              <Button variant="accent" onClick={handleLogout}>
                <LogOut size={18} /> Uitloggen
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                'mb-6 p-4 rounded-xl flex items-center gap-3',
                message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              )}
            >
              {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span className="flex-1">{message.text}</span>
              <button onClick={() => setMessage(null)} className="opacity-50 hover:opacity-100">×</button>
            </motion.div>
          )}

          {view === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto py-12"
            >
              <div className="text-center mb-12">
                <h2 className="text-5xl font-['Staatliches',sans-serif] text-[#454c9b] mb-4">Welkom bij Xerte File Manager</h2>
                <p className="text-xl text-gray-600">Kies je rol om verder te gaan</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView('student')}
                  className="cursor-pointer"
                >
                  <Card className="p-8 h-full flex flex-col items-center text-center hover:border-[#cfd600] border-2 border-transparent transition-all group">
                    <div className="w-24 h-24 bg-[#cfd600]/10 rounded-full flex items-center justify-center mb-6 group-hover:bg-[#cfd600]/20 transition-colors">
                      <UploadIcon size={48} className="text-[#454c9b]" />
                    </div>
                    <h3 className="text-3xl font-['Staatliches',sans-serif] text-[#454c9b] mb-4">Ik ben een Student</h3>
                    <p className="text-gray-600 mb-8">Upload je Xerte opdrachten snel en eenvoudig naar de juiste klas en docent.</p>
                    <Button variant="secondary" className="w-full mt-auto">
                      Bestand Inleveren
                    </Button>
                  </Card>
                </motion.div>

                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (teacherProfile) {
                      setView(teacherProfile.isAdmin ? 'admin-dashboard' : 'teacher-dashboard');
                    } else {
                      setView('teacher-login');
                    }
                  }}
                  className="cursor-pointer"
                >
                  <Card className="p-8 h-full flex flex-col items-center text-center hover:border-[#454c9b] border-2 border-transparent transition-all group">
                    <div className="w-24 h-24 bg-[#454c9b]/10 rounded-full flex items-center justify-center mb-6 group-hover:bg-[#454c9b]/20 transition-colors">
                      <Users size={48} className="text-[#454c9b]" />
                    </div>
                    <h3 className="text-3xl font-['Staatliches',sans-serif] text-[#454c9b] mb-4">Ik ben een Docent</h3>
                    <p className="text-gray-600 mb-8">Beheer opdrachten, bekijk inzendingen van studenten en download ZIP-archieven.</p>
                    <Button className="w-full mt-auto">
                      Inloggen Dashboard
                    </Button>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          )}

          {view === 'student' && (
            <motion.div
              key="student"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto"
            >
              {uploadReceipt ? (
                <Card className="p-8 border-2 border-[#cfd600]">
                  <div className="text-center space-y-6">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle size={48} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-['Staatliches',sans-serif] text-[#454c9b]">Inleverbewijs</h2>
                      <p className="text-gray-500">Je opdracht is succesvol ontvangen.</p>
                    </div>
                    
                    <div className="bg-gray-50 rounded-xl p-6 text-left space-y-3 border border-gray-100">
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-gray-500 text-sm">Student:</span>
                        <span className="font-bold">{uploadReceipt.studentName}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-gray-500 text-sm">Klas:</span>
                        <span className="font-bold">{uploadReceipt.studentClass}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-gray-500 text-sm">Opdracht:</span>
                        <span className="font-bold">{uploadReceipt.assignmentName}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-gray-500 text-sm">Bestand:</span>
                        <span className="font-bold truncate max-w-[200px]">{uploadReceipt.fileName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Tijdstip:</span>
                        <span className="font-bold">{uploadReceipt.date}</span>
                      </div>
                    </div>

                    <Button className="w-full py-4" onClick={() => setUploadReceipt(null)}>
                      Nog een bestand inleveren
                    </Button>
                    <p className="text-xs text-gray-400 italic">Maak een screenshot van dit bewijs voor je eigen administratie.</p>
                  </div>
                </Card>
              ) : (
                <Card className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-[#f25ca3] rounded-2xl flex items-center justify-center text-white">
                      <UploadIcon size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-['Staatliches',sans-serif] text-[#454c9b]">Bestand Inleveren</h2>
                      <p className="text-gray-500 text-sm">Upload je opdracht voor je klas.</p>
                    </div>
                  </div>

                  <form onSubmit={handleStudentUpload} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-600">Naam student</label>
                      <Input 
                        required 
                        placeholder="Bijv. Jan Jansen" 
                        value={studentName}
                        onChange={e => setStudentName(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">Docent</label>
                        <Select 
                          required 
                          value={studentTeacherId}
                          onChange={e => {
                            setStudentTeacherId(e.target.value);
                            setStudentClass('');
                            setSelectedAssignment('');
                            fetchClasses(e.target.value);
                          }}
                        >
                          <option value="">Kies je docent...</option>
                          {publicTeachers.map(t => (
                            <option key={t.id} value={t.id}>{t.username}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">Klas</label>
                        <Select 
                          required 
                          value={studentClass}
                          onChange={e => {
                            setStudentClass(e.target.value);
                            setSelectedAssignment('');
                            fetchAssignments(e.target.value, studentTeacherId);
                          }}
                          disabled={!studentTeacherId}
                        >
                          <option value="">{studentTeacherId ? 'Kies je klas...' : 'Kies eerst een docent'}</option>
                          {availableClasses.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-600">Opdracht</label>
                      <Select 
                        required 
                        value={selectedAssignment}
                        onChange={e => setSelectedAssignment(e.target.value)}
                        disabled={!studentClass}
                      >
                        <option value="">{studentClass ? 'Kies een opdracht...' : 'Kies eerst een klas'}</option>
                        {assignments.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-600">Bestand (PDF, DOC, DOCX, ZIP - Max 20MB)</label>
                      <div 
                        className={cn(
                          "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
                          selectedFile ? "border-[#cfd600] bg-[#cfd600]/5" : "border-gray-200 hover:border-[#454c9b] hover:bg-gray-50"
                        )}
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <input 
                          id="file-upload"
                          type="file" 
                          className="hidden" 
                          onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                          accept=".pdf,.doc,.docx,.zip"
                        />
                        {selectedFile ? (
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="text-[#cfd600]" size={40} />
                            <span className="font-medium text-gray-700">{selectedFile.name}</span>
                            <span className="text-xs text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <UploadIcon className="text-gray-300" size={40} />
                            <span className="text-gray-500">Klik of sleep om een bestand te uploaden</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button type="submit" className="w-full py-4 text-lg" disabled={loading || !selectedFile || !selectedAssignment}>
                      {loading ? 'Bezig met uploaden...' : 'Opdracht Inleveren'}
                    </Button>
                  </form>
                </Card>
              )}
            </motion.div>
          )}

          {view === 'teacher-login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto"
            >
              <Card className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-['Staatliches',sans-serif] text-[#454c9b]">
                    {isRegistering ? 'Docent Registreren' : 'Docent Portaal'}
                  </h2>
                  <p className="text-gray-500">
                    {isRegistering 
                      ? 'Maak een nieuw docentenaccount aan.' 
                      : 'Log in met je inloggegevens.'}
                  </p>
                </div>
                <form onSubmit={isRegistering ? handleRegister : handleTeacherLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-600">Gebruikersnaam</label>
                    <Input 
                      required 
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-600">Wachtwoord</label>
                    <Input 
                      type="password"
                      required 
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                    />
                  </div>
                  {isRegistering && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-600">Registratiecode</label>
                      <Input 
                        type="password"
                        required 
                        placeholder="Geheime code"
                        value={registrationCode}
                        onChange={e => setRegistrationCode(e.target.value)}
                      />
                    </div>
                  )}
                  <Button type="submit" className="w-full py-3" disabled={loading}>
                    {isRegistering ? <Plus size={18} /> : <LogIn size={18} />} 
                    {loading ? 'Bezig...' : (isRegistering ? 'Registreren' : 'Inloggen')}
                  </Button>
                  
                  <div className="text-center pt-2">
                    <button 
                      type="button"
                      className="text-sm text-[#454c9b] hover:underline font-medium"
                      onClick={() => setIsRegistering(!isRegistering)}
                    >
                      {isRegistering ? 'Al een account? Log hier in' : 'Nog geen account? Registreer hier'}
                    </button>
                  </div>

                  <Button variant="ghost" className="w-full" onClick={() => {
                    setView('student');
                    setIsRegistering(false);
                  }}>
                    Terug naar studentenpagina
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}

          {view === 'teacher-dashboard' && teacherProfile && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Stats & Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="p-6 col-span-1">
                  <h3 className="text-xl font-['Staatliches',sans-serif] text-[#454c9b] mb-4 flex items-center gap-2">
                    <Plus size={20} /> Nieuwe Opdracht
                  </h3>
                  <form onSubmit={handleCreateAssignment} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500">Naam opdracht</label>
                      <Input 
                        placeholder="Bijv. Verslag Duurzaamheid" 
                        value={newAssignmentName}
                        onChange={e => setNewAssignmentName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500">Voor welke klassen? (leeg = alle)</label>
                      <div className="flex flex-wrap gap-2 p-2 border border-gray-100 rounded-lg bg-gray-50">
                        {availableClasses.map(c => (
                          <label key={c} className="flex items-center gap-1 text-xs cursor-pointer hover:text-[#454c9b]">
                            <input 
                              type="checkbox" 
                              checked={newAssignmentClasses.includes(c)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewAssignmentClasses([...newAssignmentClasses, c]);
                                } else {
                                  setNewAssignmentClasses(newAssignmentClasses.filter(ac => ac !== c));
                                }
                              }}
                              className="w-3 h-3 rounded border-gray-300"
                            />
                            {c}
                          </label>
                        ))}
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Bezig...' : 'Opdracht Aanmaken'}
                    </Button>
                  </form>

                  <div className="mt-8">
                    <h4 className="text-sm font-bold text-gray-500 mb-3 border-b pb-1">Bestaande Opdrachten</h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {assignments.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Nog geen opdrachten.</p>
                      ) : (
                        assignments.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 group">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{a.name}</span>
                              <span className="text-[10px] text-gray-400">
                                {a.target_classes.length > 0 ? `Klassen: ${a.target_classes.join(', ')}` : 'Alle klassen'}
                              </span>
                            </div>
                            <button 
                              onClick={() => handleDeleteAssignment(a.id)}
                              className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                              title="Verwijder opdracht"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="p-6 col-span-2">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-['Staatliches',sans-serif] text-[#454c9b] flex items-center gap-2">
                      <Plus size={20} /> Mijn Klassen
                    </h3>
                  </div>
                  
                  <form onSubmit={handleCreateClass} className="space-y-4 mb-6">
                    <div className="flex gap-2">
                      {isAddingNewClass ? (
                        <Input 
                          placeholder="Nieuwe klasnaam (bijv. 5A)" 
                          value={newClassName}
                          onChange={e => setNewClassName(e.target.value)}
                          required
                        />
                      ) : (
                        <Select 
                          value={selectedGlobalClass}
                          onChange={e => setSelectedGlobalClass(e.target.value)}
                          required
                        >
                          <option value="">Kies een bestaande klas...</option>
                          {globalClasses
                            .filter(gc => !availableClasses.includes(gc))
                            .map(gc => (
                              <option key={gc} value={gc}>{gc}</option>
                            ))
                          }
                        </Select>
                      )}
                      <Button type="submit" disabled={loading || (!newClassName && !selectedGlobalClass)}>
                        {isAddingNewClass ? 'Aanmaken' : 'Koppelen'}
                      </Button>
                    </div>
                    <button 
                      type="button"
                      className="text-xs text-[#454c9b] hover:underline font-medium"
                      onClick={() => {
                        setIsAddingNewClass(!isAddingNewClass);
                        setNewClassName('');
                        setSelectedGlobalClass('');
                      }}
                    >
                      {isAddingNewClass ? 'Terug naar bestaande klassen' : 'Klas staat er niet tussen? Maak een nieuwe aan'}
                    </button>
                  </form>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableClasses.length === 0 ? (
                      <p className="text-sm text-gray-400 italic col-span-2">Je hebt nog geen klassen toegevoegd.</p>
                    ) : (
                      availableClasses.map(c => (
                        <div key={c} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-3 group">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-lg">Klas {c}</span>
                            <button 
                              onClick={() => handleDeleteClass(c)}
                              className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <Select 
                              className="text-sm py-1 h-9" 
                              value={selectedClassAssignments[c] || ''}
                              onChange={(e) => setSelectedClassAssignments(prev => ({ ...prev, [c]: e.target.value }))}
                            >
                              <option value="">Kies opdracht...</option>
                              {assignments.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </Select>
                            <a 
                              href={selectedClassAssignments[c] ? `/api/download-zip/${c}/${selectedClassAssignments[c]}` : '#'}
                              target={selectedClassAssignments[c] ? "_blank" : undefined}
                              rel="noopener noreferrer"
                              className={cn(
                                "h-9 px-3 flex items-center justify-center rounded-md transition-colors",
                                !selectedClassAssignments[c] 
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              )}
                              onClick={(e) => !selectedClassAssignments[c] && e.preventDefault()}
                            >
                              <Download size={16} />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              {/* Filters */}
              <Card className="p-4 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input 
                    className="pl-10" 
                    placeholder="Zoek op studentnaam..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-gray-400" />
                  <Select className="w-32" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="all">Alle klassen</option>
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Select className="w-48" value={assignmentFilter} onChange={e => setAssignmentFilter(e.target.value)}>
                    <option value="all">Alle opdrachten</option>
                    {assignments.map(a => <option key={a.id} value={a.id.toString()}>{a.name}</option>)}
                  </Select>
                </div>
              </Card>

              {/* Uploads Table */}
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-bottom border-gray-100">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600">Student</th>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600">Klas</th>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600">Opdracht</th>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600">Datum</th>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600 text-right">Actie</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUploads.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                            Geen uploads gevonden.
                          </td>
                        </tr>
                      ) : (
                        filteredUploads.map(u => (
                          <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium">{u.student_name}</td>
                            <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{u.student_class}</span></td>
                            <td className="px-6 py-4">{u.assignment_name}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {format(new Date(u.upload_date), 'dd-MM-yyyy HH:mm')}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <a 
                                href={`/api/download/${u.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-gray-100 transition-colors text-gray-600"
                                title="Downloaden"
                              >
                                <Download size={16} />
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {view === 'admin-dashboard' && teacherProfile?.isAdmin && (
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Admin Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
                <button 
                  onClick={() => setAdminTab('teachers')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all",
                    adminTab === 'teachers' ? "bg-[#454c9b] text-white" : "text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <Users size={18} /> Docenten
                </button>
                <button 
                  onClick={() => setAdminTab('stats')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all",
                    adminTab === 'stats' ? "bg-[#454c9b] text-white" : "text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <BarChart3 size={18} /> Statistieken
                </button>
                <button 
                  onClick={() => setAdminTab('uploads')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all",
                    adminTab === 'uploads' ? "bg-[#454c9b] text-white" : "text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <Database size={18} /> Alle Uploads
                </button>
                <button 
                  onClick={() => setAdminTab('settings')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all",
                    adminTab === 'settings' ? "bg-[#454c9b] text-white" : "text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <Settings size={18} /> Instellingen
                </button>
              </div>

              {adminTab === 'teachers' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="space-y-8 col-span-1">
                    <Card className="p-6">
                      <h3 className="text-xl font-['Staatliches',sans-serif] text-[#454c9b] mb-4 flex items-center gap-2">
                        <Plus size={20} /> Nieuwe Docent
                      </h3>
                      <form onSubmit={handleCreateTeacher} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500">Gebruikersnaam</label>
                          <Input 
                            placeholder="Gebruikersnaam" 
                            value={newTeacherUsername}
                            onChange={e => setNewTeacherUsername(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500">Wachtwoord</label>
                          <Input 
                            type="password"
                            placeholder="Wachtwoord" 
                            value={newTeacherPassword}
                            onChange={e => setNewTeacherPassword(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex items-center gap-2 py-2">
                          <input 
                            type="checkbox" 
                            id="isAdmin"
                            checked={newTeacherIsAdmin}
                            onChange={e => setNewTeacherIsAdmin(e.target.checked)}
                            className="w-4 h-4 text-[#454c9b] rounded border-gray-300 focus:ring-[#454c9b]"
                          />
                          <label htmlFor="isAdmin" className="text-sm font-semibold text-gray-600">Beheerder rechten</label>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? 'Bezig...' : 'Account Aanmaken'}
                        </Button>
                      </form>
                    </Card>

                    <Card className="p-6">
                      <h3 className="text-xl font-['Staatliches',sans-serif] text-[#454c9b] mb-4 flex items-center gap-2">
                        <Shield size={20} /> Systeem Informatie
                      </h3>
                      <div className="space-y-4 text-sm text-gray-600">
                        <p>Als beheerder kun je docenten accounts aanmaken en verwijderen.</p>
                        <p>Docenten beheren nu zelf hun eigen klassen en opdrachten.</p>
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="font-bold text-blue-700 mb-1">Tip:</p>
                          <p>Studenten kiezen eerst hun docent voordat ze hun klas en opdracht kunnen zien.</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <Card className="p-6 col-span-2">
                    <h3 className="text-xl font-['Staatliches',sans-serif] text-[#454c9b] mb-4 flex items-center gap-2">
                      <Users size={20} /> Docenten Overzicht
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-600">Gebruiker</th>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-600">Rol</th>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-600 text-right">Acties</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {teachers.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-4 font-medium">{t.username}</td>
                              <td className="px-4 py-4">
                                {t.isAdmin ? (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">ADMIN</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">DOCENT</span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    variant="ghost" 
                                    className="p-1.5 h-auto" 
                                    title="Wachtwoord wijzigen"
                                    onClick={() => setEditingTeacherId(editingTeacherId === t.id ? null : t.id)}
                                  >
                                    <Key size={14} />
                                  </Button>
                                  {t.id !== teacherProfile.id && (
                                    <Button 
                                      variant="ghost" 
                                      className="p-1.5 h-auto text-red-500 hover:bg-red-50" 
                                      title="Verwijderen"
                                      onClick={() => handleDeleteTeacher(t.id)}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  )}
                                </div>
                                {editingTeacherId === t.id && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-2 flex gap-2"
                                  >
                                    <Input 
                                      type="password" 
                                      placeholder="Nieuw wachtwoord" 
                                      className="h-8 text-xs"
                                      value={newPassword}
                                      onChange={e => setNewPassword(e.target.value)}
                                    />
                                    <Button 
                                      className="h-8 px-2 text-xs" 
                                      onClick={() => handleChangePassword(t.id)}
                                      disabled={loading}
                                    >
                                      Opslaan
                                    </Button>
                                  </motion.div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}

              {adminTab === 'stats' && adminStats && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-6 bg-gradient-to-br from-[#454c9b] to-[#363b7a] text-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white/70 text-sm font-bold uppercase tracking-wider">Totaal Uploads</p>
                          <h4 className="text-4xl font-['Staatliches',sans-serif] mt-1">{adminStats.totalUploads}</h4>
                        </div>
                        <UploadIcon className="text-white/20" size={40} />
                      </div>
                    </Card>
                    <Card className="p-6 bg-gradient-to-br from-[#cfd600] to-[#b8be00] text-[#454c9b]">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[#454c9b]/70 text-sm font-bold uppercase tracking-wider">Opdrachten</p>
                          <h4 className="text-4xl font-['Staatliches',sans-serif] mt-1">{adminStats.totalAssignments}</h4>
                        </div>
                        <FileText className="text-[#454c9b]/20" size={40} />
                      </div>
                    </Card>
                    <Card className="p-6 bg-gradient-to-br from-[#f25ca3] to-[#d94a8d] text-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white/70 text-sm font-bold uppercase tracking-wider">Docenten</p>
                          <h4 className="text-4xl font-['Staatliches',sans-serif] mt-1">{adminStats.totalTeachers}</h4>
                        </div>
                        <Users className="text-white/20" size={40} />
                      </div>
                    </Card>
                    <Card className="p-6 bg-white border-2 border-gray-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-gray-400 text-sm font-bold uppercase tracking-wider">Opslag Gebruik</p>
                          <h4 className="text-4xl font-['Staatliches',sans-serif] mt-1 text-[#454c9b]">{formatSize(adminStats.totalSize)}</h4>
                        </div>
                        <HardDrive className="text-gray-100" size={40} />
                      </div>
                    </Card>
                  </div>

                  <Card className="p-6">
                    <h3 className="text-xl font-['Staatliches',sans-serif] text-[#454c9b] mb-6 flex items-center gap-2">
                      <Clock size={20} /> Docent Activiteit
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-600">Docent</th>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-600">Laatst Actief</th>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-600">Uploads</th>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {adminStats.teacherStats.map((stat: any) => (
                            <tr key={stat.username} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-4 font-bold text-[#454c9b]">{stat.username}</td>
                              <td className="px-4 py-4 text-sm text-gray-600">
                                {stat.last_login ? format(new Date(stat.last_login), 'dd-MM-yyyy HH:mm') : 'Nooit'}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-[#cfd600]" 
                                      style={{ width: `${Math.min(100, (stat.upload_count / (adminStats.totalUploads || 1)) * 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold">{stat.upload_count}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                {stat.last_login && new Date().getTime() - new Date(stat.last_login).getTime() < 10 * 60 * 1000 ? (
                                  <span className="flex items-center gap-1 text-emerald-500 text-[10px] font-bold uppercase">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Online
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[10px] font-bold uppercase">Offline</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}

              {adminTab === 'uploads' && (
                <Card className="p-6">
                  <h3 className="text-xl font-['Staatliches',sans-serif] text-[#454c9b] mb-6 flex items-center gap-2">
                    <Database size={20} /> Alle Systeem Uploads
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-sm text-gray-600">Student</th>
                          <th className="px-4 py-3 font-semibold text-sm text-gray-600">Klas</th>
                          <th className="px-4 py-3 font-semibold text-sm text-gray-600">Opdracht</th>
                          <th className="px-4 py-3 font-semibold text-sm text-gray-600">Docent</th>
                          <th className="px-4 py-3 font-semibold text-sm text-gray-600">Datum</th>
                          <th className="px-4 py-3 font-semibold text-sm text-gray-600">Bestand</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {allUploads.map(upload => (
                          <tr key={upload.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4 font-bold text-[#454c9b]">{upload.student_name}</td>
                            <td className="px-4 py-4 text-sm font-semibold">{upload.student_class}</td>
                            <td className="px-4 py-4 text-sm text-gray-600">{upload.assignment_name}</td>
                            <td className="px-4 py-4 text-sm text-gray-500 italic">{upload.teacher_name}</td>
                            <td className="px-4 py-4 text-xs text-gray-400">
                              {format(new Date(upload.upload_date), 'dd-MM-yyyy HH:mm')}
                            </td>
                            <td className="px-4 py-4">
                              <a 
                                href={`/api/download/${upload.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#454c9b] hover:text-[#cfd600] transition-colors inline-block"
                              >
                                <Download size={18} />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {adminTab === 'settings' && adminSettings && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card className="p-6">
                    <h3 className="text-xl font-['Staatliches',sans-serif] text-[#454c9b] mb-6 flex items-center gap-2">
                      <Settings size={20} /> Systeem Instellingen
                    </h3>
                    <form onSubmit={handleUpdateSettings} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-600">Registratiecode voor Docenten</label>
                        <Input 
                          value={adminSettings.registration_code}
                          onChange={e => setAdminSettings({...adminSettings, registration_code: e.target.value})}
                          placeholder="Bijv. DOCENT2024!"
                        />
                        <p className="text-xs text-gray-400">Nieuwe docenten moeten deze code invoeren om een account aan te maken.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-600">Onderhoudsmodus</label>
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <button
                            type="button"
                            onClick={() => setAdminSettings({...adminSettings, maintenance_mode: adminSettings.maintenance_mode === 'true' ? 'false' : 'true'})}
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              adminSettings.maintenance_mode === 'true' ? "bg-red-500" : "bg-gray-300"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                              adminSettings.maintenance_mode === 'true' ? "right-1" : "left-1"
                            )} />
                          </button>
                          <span className="text-sm font-semibold">
                            {adminSettings.maintenance_mode === 'true' ? 'Ingeschakeld (Uploaden geblokkeerd)' : 'Uitgeschakeld'}
                          </span>
                        </div>
                      </div>

                      <Button type="submit" className="w-full" disabled={loading}>
                        Instellingen Opslaan
                      </Button>
                    </form>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-xl font-['Staatliches',sans-serif] text-red-500 mb-6 flex items-center gap-2">
                      <Archive size={20} /> Opschoon Tool
                    </h3>
                    <div className="space-y-6">
                      <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-red-700 text-sm">
                        <p className="font-bold flex items-center gap-2 mb-2">
                          <AlertTriangle size={16} /> Let op!
                        </p>
                        <p>Deze actie verwijdert definitief alle bestanden en database records die ouder zijn dan de gekozen periode. Dit kan niet ongedaan worden gemaakt.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-600">Verwijder uploads ouder dan:</label>
                        <Select 
                          value={cleanupMonths}
                          onChange={e => setCleanupMonths(e.target.value)}
                        >
                          <option value="0">Alle bestanden (Direct opschonen)</option>
                          <option value="1">Ouder dan 1 maand</option>
                          <option value="3">Ouder dan 3 maanden</option>
                          <option value="6">Ouder dan 6 maanden</option>
                          <option value="12">Ouder dan 1 jaar (Aanbevolen)</option>
                          <option value="24">Ouder dan 2 jaar</option>
                        </Select>
                      </div>

                      <Button 
                        onClick={handleCleanup}
                        variant="accent" 
                        className={cn(
                          "w-full transition-all",
                          showCleanupConfirm ? "bg-red-700 hover:bg-red-800" : "bg-red-500 hover:bg-red-600"
                        )}
                        disabled={loading}
                      >
                        {showCleanupConfirm ? 'Klik nogmaals om te bevestigen' : 'Start Opschonen'}
                      </Button>
                      {showCleanupConfirm && (
                        <button 
                          onClick={() => setShowCleanupConfirm(false)}
                          className="w-full text-xs text-gray-400 hover:text-gray-600 mt-2"
                        >
                          Annuleren
                        </button>
                      )}
                    </div>
                  </Card>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-gray-100 text-center text-gray-400 text-sm">
        <p>&copy; 2026 Graafschap College - Xerte File Manager | Gemaakt door Daan Bosch</p>
      </footer>

      {/* Custom Styles for Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Staatliches&family=Kiro:wght@400;700&display=swap');
        
        body {
          font-family: 'Kiro', sans-serif;
        }
        
        h1, h2, h3, .font-staatliches {
          font-family: 'Staatliches', cursive;
        }
      `}</style>
      </div>
  );
}
