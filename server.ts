import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import multer from 'multer';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('database.sqlite');
const JWT_SECRET = process.env.JWT_SECRET || 'graafschap-secret-key';

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    classes TEXT, -- JSON array of classes
    is_admin INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    teacher_id INTEGER,
    FOREIGN KEY(teacher_id) REFERENCES teachers(id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    target_classes TEXT, -- JSON array of classes
    created_by INTEGER,
    FOREIGN KEY(created_by) REFERENCES teachers(id)
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT,
    student_class TEXT,
    assignment_id INTEGER,
    original_filename TEXT,
    server_filename TEXT,
    file_size INTEGER DEFAULT 0,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assignment_id) REFERENCES assignments(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migration: Add teacher_id to classes if it doesn't exist
try {
  db.exec('ALTER TABLE classes ADD COLUMN teacher_id INTEGER');
} catch (e) {}

// Migration: Remove UNIQUE constraint from classes name
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='classes'").get() as { sql: string };
  if (tableInfo && tableInfo.sql.includes('UNIQUE')) {
    console.log('Migrating classes table to remove UNIQUE constraint...');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE classes_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          teacher_id INTEGER,
          FOREIGN KEY(teacher_id) REFERENCES teachers(id)
        );
        INSERT INTO classes_new (id, name, teacher_id) SELECT id, name, teacher_id FROM classes;
        DROP TABLE classes;
        ALTER TABLE classes_new RENAME TO classes;
      `);
    })();
    console.log('Migration complete.');
  }
} catch (e) {
  console.error('Migration failed:', e);
}

// Migration: Add target_classes column if it doesn't exist
try {
  db.exec('ALTER TABLE assignments ADD COLUMN target_classes TEXT');
} catch (e) {
  // Column probably already exists
}

// Migration: Add is_admin column if it doesn't exist
try {
  db.exec('ALTER TABLE teachers ADD COLUMN is_admin INTEGER DEFAULT 0');
} catch (e) {}

// Migration: Add last_login column if it doesn't exist
try {
  db.exec('ALTER TABLE teachers ADD COLUMN last_login DATETIME');
} catch (e) {}

// Migration: Add file_size column if it doesn't exist
try {
  db.exec('ALTER TABLE uploads ADD COLUMN file_size INTEGER DEFAULT 0');
} catch (e) {}

// Seed default settings
const regCode = db.prepare('SELECT * FROM settings WHERE key = ?').get('registration_code');
if (!regCode) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('registration_code', 'GRAAFSCHAP2024');
}
const maintenanceMode = db.prepare('SELECT * FROM settings WHERE key = ?').get('maintenance_mode');
if (!maintenanceMode) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('maintenance_mode', 'false');
}

// Seed initial admin if not exists
const adminExists = db.prepare('SELECT * FROM teachers WHERE username = ?').get('admin');
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('Welkom01', 10);
  db.prepare('INSERT INTO teachers (username, password, classes, is_admin) VALUES (?, ?, ?, ?)').run('admin', hashedPassword, JSON.stringify(['3A', '3B', '4A']), 1);
}

// Seed initial classes if none exist
const classCount = db.prepare('SELECT count(*) as count FROM classes').get() as { count: number };
if (classCount.count === 0) {
  const initialClasses = ['3A', '3B', '4A'];
  const insertClass = db.prepare('INSERT INTO classes (name) VALUES (?)');
  initialClasses.forEach(c => {
    try { insertClass.run(c); } catch (e) {}
  });
}

const app = express();
app.use(express.json());
app.use(cookieParser());

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { student_class } = req.body;
    const dir = path.join(__dirname, 'uploads', `klas_${student_class}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const { student_name, student_class } = req.body;
    const date = new Date().toISOString().split('T')[0];
    const ext = path.extname(file.originalname);
    const safeName = (student_name || 'student').replace(/[^a-z0-9]/gi, '_');
    const filename = `${student_class || 'unknown'}_${safeName}_${date}_${file.originalname}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Ongeldig bestandstype. Alleen PDF, DOC, DOCX en ZIP zijn toegestaan.'));
    }
  }
});

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Niet ingelogd' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.teacher = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Ongeldige sessie' });
  }
};

// API Routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const teacher = db.prepare('SELECT * FROM teachers WHERE username = ?').get(username) as any;
  if (teacher && bcrypt.compareSync(password, teacher.password)) {
    const token = jwt.sign({ 
      id: teacher.id, 
      username: teacher.username, 
      classes: JSON.parse(teacher.classes || '[]'),
      isAdmin: !!teacher.is_admin 
    }, JWT_SECRET);

    // Update last login
    db.prepare('UPDATE teachers SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(teacher.id);

    res.cookie('token', token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    res.json({ username: teacher.username, classes: JSON.parse(teacher.classes || '[]'), isAdmin: !!teacher.is_admin });
  } else {
    res.status(401).json({ error: 'Ongeldige inloggegevens' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.post('/api/register', (req, res) => {
  const { username, password, registrationCode } = req.body;
  
  const settingsRegCode = db.prepare('SELECT value FROM settings WHERE key = ?').get('registration_code') as { value: string };
  
  if (registrationCode !== settingsRegCode.value) {
    return res.status(401).json({ error: 'Ongeldige registratiecode' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    // Initial classes as empty array
    db.prepare('INSERT INTO teachers (username, password, classes, is_admin) VALUES (?, ?, ?, ?)')
      .run(username, hashedPassword, JSON.stringify([]), 0);
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: 'Gebruikersnaam bestaat al' });
  }
});

app.get('/api/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Niet ingelogd' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json(decoded);
  } catch (e) {
    res.status(401).json({ error: 'Ongeldige sessie' });
  }
});

app.get('/api/assignments', (req, res) => {
  const { studentClass, teacherId } = req.query;
  const token = req.cookies.token;
  
  let currentTeacherId = teacherId;
  
  // If logged in, always show own assignments
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      currentTeacherId = decoded.id;
    } catch (e) {}
  }

  if (!currentTeacherId) return res.json([]);

  let assignments = db.prepare('SELECT * FROM assignments WHERE created_by = ? ORDER BY id DESC').all(currentTeacherId) as any[];
  
  if (studentClass) {
    assignments = assignments.filter(a => {
      if (!a.target_classes) return true;
      try {
        const classes = JSON.parse(a.target_classes);
        return Array.isArray(classes) && (classes.length === 0 || classes.includes(studentClass));
      } catch (e) {
        return true;
      }
    });
  }
  
  res.json(assignments.map((a: any) => ({
    ...a,
    target_classes: a.target_classes ? JSON.parse(a.target_classes) : []
  })));
});

app.get('/api/teachers/public', (req, res) => {
  const teachers = db.prepare('SELECT id, username FROM teachers WHERE is_admin = 0 OR id IN (SELECT created_by FROM assignments) ORDER BY username ASC').all();
  res.json(teachers);
});

app.get('/api/classes/global', (req, res) => {
  const classes = db.prepare('SELECT DISTINCT name FROM classes ORDER BY name ASC').all() as { name: string }[];
  res.json(classes.map(c => c.name));
});

app.get('/api/classes', (req, res) => {
  const { teacherId } = req.query;
  const token = req.cookies.token;
  
  let currentTeacherId = teacherId;
  
  // If no teacherId provided but user is logged in, use their own ID
  if (!currentTeacherId && token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      currentTeacherId = decoded.id;
    } catch (e) {}
  }

  if (currentTeacherId) {
    const classes = db.prepare('SELECT id, name FROM classes WHERE teacher_id = ? ORDER BY name ASC').all(currentTeacherId);
    res.json(classes.map((c: any) => c.name));
  } else {
    // Fallback for legacy or if no teacher selected
    const classes = db.prepare('SELECT DISTINCT name FROM classes ORDER BY name ASC').all() as { name: string }[];
    res.json(classes.map(c => c.name));
  }
});

app.post('/api/classes', authenticate, (req: any, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
  
  // Check if teacher already has this class
  const existing = db.prepare('SELECT * FROM classes WHERE name = ? AND teacher_id = ?').get(name, req.teacher.id);
  if (existing) return res.status(400).json({ error: 'Je hebt deze klas al toegevoegd' });

  db.prepare('INSERT INTO classes (name, teacher_id) VALUES (?, ?)').run(name, req.teacher.id);
  res.json({ success: true });
});

app.delete('/api/classes/:name', authenticate, (req: any, res) => {
  db.prepare('DELETE FROM classes WHERE name = ? AND teacher_id = ?').run(req.params.name, req.teacher.id);
  res.json({ success: true });
});

app.post('/api/assignments', authenticate, (req: any, res) => {
  const { name, target_classes } = req.body;
  db.prepare('INSERT INTO assignments (name, target_classes, created_by) VALUES (?, ?, ?)')
    .run(name, JSON.stringify(target_classes || []), req.teacher.id);
  res.json({ success: true });
});

app.delete('/api/assignments/:id', authenticate, (req: any, res) => {
  const assignmentId = req.params.id;
  const teacherId = req.teacher.id;

  // Verify ownership
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ? AND created_by = ?').get(assignmentId, teacherId) as any;
  if (!assignment) return res.status(404).json({ error: 'Opdracht niet gevonden' });

  // Find all uploads for this assignment to delete physical files
  const uploads = db.prepare('SELECT student_class, server_filename FROM uploads WHERE assignment_id = ?').all(assignmentId) as any[];
  
  for (const upload of uploads) {
    try {
      const filePath = path.join(__dirname, 'uploads', `klas_${upload.student_class}`, upload.server_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error(`Fout bij verwijderen bestand voor opdracht ${assignmentId}`, e);
    }
  }

  // Delete upload records first (foreign key constraint)
  db.prepare('DELETE FROM uploads WHERE assignment_id = ?').run(assignmentId);
  
  // Delete the assignment
  db.prepare('DELETE FROM assignments WHERE id = ?').run(assignmentId);
  
  res.json({ success: true });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const { student_name, student_class, assignment_id } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Geen bestand geüpload' });

  // Check maintenance mode
  const maintenance = db.prepare('SELECT value FROM settings WHERE key = ?').get('maintenance_mode') as { value: string };
  if (maintenance.value === 'true') {
    return res.status(503).json({ error: 'Systeem is tijdelijk in onderhoud. Uploaden is niet mogelijk.' });
  }

  // Check if student already uploaded for this assignment
  const existing = db.prepare('SELECT * FROM uploads WHERE student_name = ? AND assignment_id = ?').get(student_name, assignment_id) as any;
  
  if (existing) {
    // Delete old file
    const oldPath = path.join(__dirname, 'uploads', `klas_${existing.student_class}`, existing.server_filename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    
    db.prepare('UPDATE uploads SET student_class = ?, server_filename = ?, file_size = ?, upload_date = CURRENT_TIMESTAMP WHERE id = ?')
      .run(student_class, file.filename, file.size, existing.id);
  } else {
    db.prepare('INSERT INTO uploads (student_name, student_class, assignment_id, original_filename, server_filename, file_size) VALUES (?, ?, ?, ?, ?, ?)')
      .run(student_name, student_class, assignment_id, file.originalname, file.filename, file.size);
  }

  res.json({ success: true });
});

app.get('/api/uploads', authenticate, (req: any, res) => {
  const teacherId = req.teacher.id;
  
  const uploads = db.prepare(`
    SELECT u.*, a.name as assignment_name 
    FROM uploads u 
    JOIN assignments a ON u.assignment_id = a.id 
    WHERE a.created_by = ?
    ORDER BY u.upload_date DESC
  `).all(teacherId);
  res.json(uploads);
});

app.get('/api/download/:id', authenticate, (req, res) => {
  const upload = db.prepare('SELECT * FROM uploads WHERE id = ?').get(req.params.id) as any;
  if (!upload) return res.status(404).send('Bestand niet gevonden');
  
  const filePath = path.join(__dirname, 'uploads', `klas_${upload.student_class}`, upload.server_filename);
  if (!fs.existsSync(filePath)) {
    console.error(`Bestand niet gevonden op schijf: ${filePath}`);
    return res.status(404).json({ error: 'Bestand niet gevonden op de server' });
  }
  res.download(filePath, upload.server_filename);
});

app.get('/api/download-zip/:class/:assignmentId', authenticate, async (req, res) => {
  const { class: studentClass, assignmentId } = req.params;
  const uploads = db.prepare('SELECT * FROM uploads WHERE student_class = ? AND assignment_id = ?').all(studentClass, assignmentId) as any[];
  
  if (uploads.length === 0) return res.status(404).send('Geen bestanden gevonden voor deze klas en opdracht');

  const zip = new JSZip();
  const assignment = db.prepare('SELECT name FROM assignments WHERE id = ?').get(assignmentId) as any;
  const assignmentName = assignment?.name || 'Opdracht';
  
  uploads.forEach(u => {
    const filePath = path.join(__dirname, 'uploads', `klas_${u.student_class}`, u.server_filename);
    if (fs.existsSync(filePath)) {
      zip.file(u.server_filename, fs.readFileSync(filePath));
    }
  });

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  const zipName = `Klas_${studentClass}_${assignmentName.replace(/\s+/g, '_')}.zip`;
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
  res.send(content);
});

// Admin Routes
const adminOnly = (req: any, res: any, next: any) => {
  if (req.teacher && req.teacher.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Toegang geweigerd: Alleen voor beheerders' });
  }
};

app.get('/api/admin/teachers', authenticate, adminOnly, (req, res) => {
  const teachers = db.prepare('SELECT id, username, is_admin FROM teachers').all();
  res.json(teachers.map((t: any) => ({
    ...t,
    isAdmin: !!t.is_admin
  })));
});

app.post('/api/admin/teachers', authenticate, adminOnly, (req, res) => {
  const { username, password, isAdmin } = req.body;
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO teachers (username, password, is_admin) VALUES (?, ?, ?)')
      .run(username, hashedPassword, isAdmin ? 1 : 0);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: 'Gebruikersnaam bestaat al' });
  }
});

app.put('/api/admin/teachers/:id/password', authenticate, adminOnly, (req, res) => {
  const { password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE teachers SET password = ? WHERE id = ?').run(hashedPassword, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/teachers/:id', authenticate, adminOnly, (req, res) => {
  // Prevent deleting self
  if (parseInt(req.params.id) === (req as any).teacher.id) {
    return res.status(400).json({ error: 'Je kunt jezelf niet verwijderen' });
  }
  db.prepare('DELETE FROM teachers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Admin Class Routes
app.post('/api/admin/classes', authenticate, adminOnly, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
  try {
    db.prepare('INSERT INTO classes (name) VALUES (?)').run(name);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Klas bestaat al' });
  }
});

app.delete('/api/admin/classes/:name', authenticate, adminOnly, (req, res) => {
  db.prepare('DELETE FROM classes WHERE name = ?').run(req.params.name);
  res.json({ success: true });
});

// Admin Stats & Settings Routes
app.get('/api/admin/stats', authenticate, adminOnly, (req, res) => {
  const totalUploads = db.prepare('SELECT count(*) as count FROM uploads').get() as any;
  const totalAssignments = db.prepare('SELECT count(*) as count FROM assignments').get() as any;
  const totalTeachers = db.prepare('SELECT count(*) as count FROM teachers').get() as any;
  const totalSize = db.prepare('SELECT sum(file_size) as size FROM uploads').get() as any;
  
  const teacherStats = db.prepare(`
    SELECT t.username, t.last_login, count(u.id) as upload_count
    FROM teachers t
    LEFT JOIN assignments a ON a.created_by = t.id
    LEFT JOIN uploads u ON u.assignment_id = a.id
    GROUP BY t.id
    ORDER BY upload_count DESC
  `).all();

  res.json({
    totalUploads: totalUploads.count,
    totalAssignments: totalAssignments.count,
    totalTeachers: totalTeachers.count,
    totalSize: totalSize.size || 0,
    teacherStats
  });
});

app.get('/api/admin/all-uploads', authenticate, adminOnly, (req, res) => {
  const uploads = db.prepare(`
    SELECT u.*, a.name as assignment_name, t.username as teacher_name
    FROM uploads u
    JOIN assignments a ON u.assignment_id = a.id
    JOIN teachers t ON a.created_by = t.id
    ORDER BY u.upload_date DESC
  `).all();
  res.json(uploads);
});

app.get('/api/admin/settings', authenticate, adminOnly, (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all() as { key: string, value: string }[];
  const settingsMap = settings.reduce((acc: any, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {});
  res.json(settingsMap);
});

app.post('/api/admin/settings', authenticate, adminOnly, (req, res) => {
  const { registration_code, maintenance_mode } = req.body;
  
  if (registration_code !== undefined) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(registration_code, 'registration_code');
  }
  if (maintenance_mode !== undefined) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(maintenance_mode), 'maintenance_mode');
  }
  
  res.json({ success: true });
});

app.post('/api/admin/cleanup', authenticate, adminOnly, (req, res) => {
  const { months } = req.body;
  if (months === undefined) return res.status(400).json({ error: 'Aantal maanden verplicht' });

  try {
    // Use SQLite's date functions to find old uploads
    const query = `SELECT * FROM uploads WHERE upload_date < datetime('now', '-' || ? || ' months')`;
    const oldUploads = db.prepare(query).all(months) as any[];
    
    console.log(`Cleanup gestart: ${oldUploads.length} bestanden gevonden ouder dan ${months} maanden.`);
    
    let deletedCount = 0;
    oldUploads.forEach(upload => {
      try {
        const filePath = path.join(__dirname, 'uploads', `klas_${upload.student_class}`, upload.server_filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (e) {
        console.error(`Fout bij verwijderen bestand ${upload.server_filename}:`, e);
      }
    });

    // Delete records from database
    const deleteQuery = `DELETE FROM uploads WHERE upload_date < datetime('now', '-' || ? || ' months')`;
    const result = db.prepare(deleteQuery).run(months);
    
    console.log(`Cleanup voltooid: ${result.changes} records verwijderd uit DB, ${deletedCount} bestanden van schijf.`);
    
    res.json({ success: true, count: result.changes });
  } catch (error) {
    console.error('Fout tijdens cleanup:', error);
    res.status(500).json({ error: 'Interne serverfout tijdens opschonen' });
  }
});

// 404 Handler for API routes - prevents returning HTML for missing API endpoints
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint ${req.method} ${req.url} niet gevonden` });
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
