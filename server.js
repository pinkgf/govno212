const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка подключения к БД
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err);
        process.exit(1);
    }
    console.log('✅ Подключено к MySQL');
    
    // Создаем таблицы при запуске
    initTables();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'technikum_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 3600000 // 1 час
    }
}));

// Middleware для проверки авторизации
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Middleware для проверки прав администратора
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Доступ запрещен. Только для администратора' });
    }
}

// Настройка загрузки фото
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения!'));
        }
    }
});

// Инициализация таблиц
function initTables() {
    // Таблица пользователей
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            role ENUM('admin', 'teacher', 'student') DEFAULT 'student',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP NULL
        )
    `;
    
    // Таблица курсов
    const createCoursesTable = `
        CREATE TABLE IF NOT EXISTS courses (
            id INT PRIMARY KEY AUTO_INCREMENT,
            course_name VARCHAR(100) NOT NULL,
            course_code VARCHAR(20) NOT NULL UNIQUE,
            description TEXT,
            teacher_id INT,
            max_students INT DEFAULT 30,
            schedule VARCHAR(200),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    
    db.query(createUsersTable, (err) => {
        if (err) console.error('Ошибка создания users:', err);
        else console.log('✅ Таблица users готова');
    });
    
    db.query(createCoursesTable, (err) => {
        if (err) console.error('Ошибка создания courses:', err);
        else console.log('✅ Таблица courses готова');
    });
    
    // Добавляем тестовые данные через 1 секунду
    setTimeout(() => {
        // Проверяем админа
        db.query('SELECT * FROM users WHERE username = ?', ['admin'], async (err, results) => {
            if (err) return;
            if (results.length === 0) {
                const hash = await bcrypt.hash('123456', 10);
                db.query(
                    'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
                    ['admin', 'admin@technikum.com', hash, 'Администратор', 'admin'],
                    (err) => {
                        if (err) console.error('Ошибка создания админа:', err);
                        else console.log('✅ Создан администратор: admin / 123456');
                    }
                );
            }
        });
        
        // Проверяем преподавателей
        db.query('SELECT * FROM users WHERE username = ?', ['ivanov'], async (err, results) => {
            if (err) return;
            if (results.length === 0) {
                const hash = await bcrypt.hash('123456', 10);
                db.query(
                    'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
                    ['ivanov', 'ivanov@technikum.com', hash, 'Иван Иванов', 'teacher'],
                    (err) => {
                        if (err) console.error('Ошибка создания преподавателя:', err);
                        else console.log('✅ Создан преподаватель: ivanov / 123456');
                    }
                );
            }
        });
        
        db.query('SELECT * FROM users WHERE username = ?', ['petrova'], async (err, results) => {
            if (err) return;
            if (results.length === 0) {
                const hash = await bcrypt.hash('123456', 10);
                db.query(
                    'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
                    ['petrova', 'petrova@technikum.com', hash, 'Мария Петрова', 'teacher'],
                    (err) => {
                        if (err) console.error('Ошибка создания преподавателя:', err);
                        else console.log('✅ Создан преподаватель: petrova / 123456');
                    }
                );
            }
        });
        
        // Проверяем курсы
        db.query('SELECT COUNT(*) as count FROM courses', (err, results) => {
            if (err) return;
            if (results[0].count === 0) {
                // Добавляем курсы после того как пользователи созданы
                setTimeout(() => {
                    db.query('SELECT id FROM users WHERE username = ?', ['ivanov'], (err, ivanov) => {
                        db.query('SELECT id FROM users WHERE username = ?', ['petrova'], (err, petrova) => {
                            const ivanovId = ivanov && ivanov[0] ? ivanov[0].id : null;
                            const petrovaId = petrova && petrova[0] ? petrova[0].id : null;
                            
                            const courses = [
                                ['Веб-разработка на React', 'REACT101', 'Изучение современного фреймворка React и создание SPA приложений', ivanovId, 25, 'Пн/Ср 10:00-12:00'],
                                ['Python для анализа данных', 'PYTHON202', 'Основы Python, библиотеки pandas, numpy для анализа данных', ivanovId, 30, 'Вт/Чт 14:00-16:00'],
                                ['Базы данных MySQL', 'DB303', 'Проектирование и оптимизация баз данных, сложные запросы', petrovaId, 20, 'Пт 13:00-16:00'],
                                ['JavaScript с нуля', 'JS101', 'Базовый и продвинутый JavaScript, асинхронность, API', ivanovId, 35, 'Пн/Ср 15:00-17:00'],
                                ['Node.js backend', 'NODE404', 'Разработка серверных приложений на Node.js и Express', petrovaId, 25, 'Вт/Чт 10:00-12:00'],
                                ['Мобильная разработка', 'MOBILE505', 'Разработка мобильных приложений на React Native', ivanovId, 20, 'Ср/Пт 14:00-16:00']
                            ];
                            
                            courses.forEach(course => {
                                db.query(
                                    'INSERT INTO courses (course_name, course_code, description, teacher_id, max_students, schedule) VALUES (?, ?, ?, ?, ?, ?)',
                                    course,
                                    (err) => {
                                        if (err) console.error('Ошибка добавления курса:', err);
                                    }
                                );
                            });
                            console.log('✅ Добавлены тестовые курсы');
                        });
                    });
                }, 1000);
            }
        });
    }, 1000);
}

// ==================== HTML СТРАНИЦЫ ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'about.html'));
});

app.get('/contacts', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'contacts.html'));
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Админ панель управления БД
app.get('/admin/db', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Доступ запрещен');
    }
    res.sendFile(path.join(__dirname, 'views', 'admin_db.html'));
});

// ==================== API АВТОРИЗАЦИИ ====================

// Регистрация нового пользователя
app.post('/api/register', async (req, res) => {
    const { username, email, full_name, password } = req.body;
    
    // Валидация
    if (!username || !email || !full_name || !password) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Логин должен быть не менее 3 символов' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }
    
    if (!email.includes('@')) {
        return res.status(400).json({ error: 'Некорректный email' });
    }
    
    // Проверяем, существует ли пользователь
    const checkQuery = 'SELECT id FROM users WHERE username = ? OR email = ?';
    db.query(checkQuery, [username, email], async (err, results) => {
        if (err) {
            console.error('DB Error:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        
        if (results.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким логином или email уже существует' });
        }
        
        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Создаем пользователя (роль по умолчанию - student)
        const insertQuery = `
            INSERT INTO users (username, email, password_hash, full_name, role) 
            VALUES (?, ?, ?, ?, 'student')
        `;
        
        db.query(insertQuery, [username, email, hashedPassword, full_name], (err, result) => {
            if (err) {
                console.error('Insert Error:', err);
                return res.status(500).json({ error: 'Ошибка при создании пользователя' });
            }
            
            res.json({ 
                success: true, 
                message: 'Регистрация успешна',
                userId: result.insertId 
            });
        });
    });
});

// Вход пользователя
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }
    
    const query = 'SELECT * FROM users WHERE username = ? OR email = ?';
    db.query(query, [username, username], async (err, results) => {
        if (err) {
            console.error('DB Error:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        
        if (results.length === 0) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        
        const user = results[0];
        const isValidPassword = (password === user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        
        // Обновляем время последнего входа
        db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role
        };
        
        res.json({ success: true, redirect: '/dashboard' });
    });
});

// Выход
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Получение текущего пользователя
app.get('/api/user', isAuthenticated, (req, res) => {
    res.json(req.session.user);
});

// ==================== API КУРСОВ ====================

// Получение всех курсов (публичный доступ)
app.get('/api/courses', (req, res) => {
    const query = `
        SELECT 
            c.*,
            u.full_name as teacher_name,
            u.username as teacher_username
        FROM courses c
        LEFT JOIN users u ON c.teacher_id = u.id
        ORDER BY c.id DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching courses:', err);
            return res.status(500).json({ error: 'Failed to fetch courses' });
        }
        res.json(results);
    });
});

// Получение курсов для дашборда (только для авторизованных)
app.get('/api/my-courses', isAuthenticated, (req, res) => {
    let query = `
        SELECT 
            c.*,
            u.full_name as teacher_name
        FROM courses c
        LEFT JOIN users u ON c.teacher_id = u.id
    `;
    
    const params = [];
    
    // Если преподаватель - показываем только его курсы
    if (req.session.user.role === 'teacher') {
        query += ` WHERE c.teacher_id = ?`;
        params.push(req.session.user.id);
    }
    
    query += ` ORDER BY c.id DESC`;
    
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error fetching my courses:', err);
            return res.status(500).json({ error: 'Failed to fetch courses' });
        }
        res.json(results);
    });
});

// Получение одного курса по ID
app.get('/api/courses/:id', (req, res) => {
    const courseId = req.params.id;
    
    const query = `
        SELECT 
            c.*,
            u.full_name as teacher_name,
            u.username as teacher_username
        FROM courses c
        LEFT JOIN users u ON c.teacher_id = u.id
        WHERE c.id = ?
    `;
    
    db.query(query, [courseId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch course' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }
        res.json(results[0]);
    });
});

// ==================== АДМИН ПАНЕЛЬ УПРАВЛЕНИЯ ====================

// Получение списка всех таблиц
app.get('/api/admin/tables', isAuthenticated, isAdmin, (req, res) => {
    db.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? 
        ORDER BY TABLE_NAME
    `, [process.env.DB_NAME], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения списка таблиц' });
        }
        const tables = results.map(row => row.TABLE_NAME);
        res.json(tables);
    });
});

// Получение данных из таблицы
app.get('/api/admin/table/:tableName', isAuthenticated, isAdmin, (req, res) => {
    const tableName = req.params.tableName;
    
    // Получаем данные
    db.query(`SELECT * FROM ?? ORDER BY id DESC`, [tableName], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения данных' });
        }
        
        // Получаем структуру таблицы
        db.query(`DESCRIBE ??`, [tableName], (err, structure) => {
            res.json({
                rows: rows,
                count: rows.length,
                tableName: tableName,
                structure: structure
            });
        });
    });
});

// Добавление записи в таблицу
app.post('/api/admin/table/:tableName', isAuthenticated, isAdmin, (req, res) => {
    const tableName = req.params.tableName;
    const data = req.body;
    
    // Убираем id если он есть (автоинкремент)
    delete data.id;
    
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(',');
    
    const query = `INSERT INTO ?? (${fields.join(',')}) VALUES (${placeholders})`;
    
    db.query(query, [tableName, ...values], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: result.insertId });
    });
});

// Обновление записи в таблице
app.put('/api/admin/table/:tableName/:id', isAuthenticated, isAdmin, (req, res) => {
    const tableName = req.params.tableName;
    const recordId = req.params.id;
    const data = req.body;
    
    // Убираем id из обновляемых данных
    delete data.id;
    
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = fields.map(field => `${field} = ?`).join(',');
    
    const query = `UPDATE ?? SET ${setClause} WHERE id = ?`;
    
    db.query(query, [tableName, ...values, recordId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, affected: result.affectedRows });
    });
});

// Удаление записи из таблицы
app.delete('/api/admin/table/:tableName/:id', isAuthenticated, isAdmin, (req, res) => {
    const tableName = req.params.tableName;
    const recordId = req.params.id;
    
    const query = `DELETE FROM ?? WHERE id = ?`;
    
    db.query(query, [tableName, recordId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, affected: result.affectedRows });
    });
});

// Выполнение SQL запроса
app.post('/api/admin/query', isAuthenticated, isAdmin, (req, res) => {
    const { sql } = req.body;
    
    if (!sql || sql.trim().length === 0) {
        return res.status(400).json({ error: 'SQL запрос не может быть пустым' });
    }
    
    // Безопасность: блокируем опасные операции
    const upperSql = sql.toUpperCase().trim();
    const dangerousOps = ['DROP DATABASE', 'DROP TABLE', 'TRUNCATE', 'ALTER TABLE'];
    
    for (const op of dangerousOps) {
        if (upperSql.includes(op)) {
            return res.status(403).json({ error: `Операция ${op} запрещена в этом интерфейсе` });
        }
    }
    
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            success: true,
            results: results,
            affectedRows: results.affectedRows || 0,
            sql: sql
        });
    });
});

// Обработка контактной формы
app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Заполните обязательные поля' });
    }
    
    console.log('Новое сообщение:', { name, email, subject, message });
    res.json({ success: true, message: 'Сообщение отправлено' });
});

// ==================== ЗАПУСК СЕРВЕРА ====================

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🚀 Сервер успешно запущен!                               ║
╠══════════════════════════════════════════════════════════════╣
║  📍 Адрес: http://localhost:${PORT}                          ║
╠══════════════════════════════════════════════════════════════╣
║  📄 Доступные страницы:                                      ║
║     • Главная: http://localhost:${PORT}/                     ║
║     • О нас: http://localhost:${PORT}/about                  ║
║     • Контакты: http://localhost:${PORT}/contacts            ║
║     • Вход: http://localhost:${PORT}/login                   ║
║     • Регистрация: http://localhost:${PORT}/register         ║
║     • Дашборд: http://localhost:${PORT}/dashboard            ║
║     • Админ панель: http://localhost:${PORT}/admin/db        ║
╠══════════════════════════════════════════════════════════════╣
║  🔐 Тестовые данные:                                         ║
║     • Админ: admin / 123456                                  ║
║     • Преподаватель: ivanov / 123456                         ║
║     • Преподаватель: petrova / 123456                        ║
╚══════════════════════════════════════════════════════════════╝
    `);
});
