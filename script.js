// kundelik-excel-uploader.js
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');
const readline = require('readline');
const open = require('open');

// Конфигурация для OAuth2
const CLIENT_ID = 'YOUR_CLIENT_ID'; // Получить при регистрации приложения
const REDIRECT_URI = 'http://localhost:3000/oauth-callback';
const API_BASE_URL = 'https://api.kundelik.kz/v1';
const AUTH_URL = `https://login.kundelik.kz/oauth2`;

// Название Excel файла (должен быть в той же директории)
const EXCEL_FILE = 'grades.xlsx';

// Создаем интерфейс для чтения ввода пользователя
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Переменная для хранения токена доступа
let accessToken = '';

// Функция для запуска процесса авторизации
async function authorize() {
    console.log('Начинаем процесс авторизации...');
    
    // Формируем URL для авторизации
    const scope = 'EducationalInfo,CommonInfo';
    const authUrl = `${AUTH_URL}?response_type=token&client_id=${CLIENT_ID}&scope=${scope}&redirect_uri=${REDIRECT_URI}`;
    
    // Открываем браузер для авторизации
    console.log('Открываем браузер для авторизации. Пожалуйста, авторизуйтесь в Kundelik.kz');
    await open(authUrl);
    
    // Запрашиваем токен у пользователя (в реальном приложении можно было бы запустить локальный сервер)
    return new Promise((resolve) => {
        rl.question('После авторизации вставьте полученный токен доступа (из адресной строки после #access_token=): ', (token) => {
            console.log('Токен получен!');
            resolve(token);
        });
    });
}

// Функция для чтения и парсинга Excel файла
function readExcelFile() {
    const filePath = path.join(__dirname, EXCEL_FILE);
    
    try {
        // Проверяем существование файла
        if (!fs.existsSync(filePath)) {
            throw new Error(`Файл ${EXCEL_FILE} не найден в директории скрипта.`);
        }
        
        console.log(`Чтение файла ${EXCEL_FILE}...`);
        
        // Читаем Excel файл
        const workbook = xlsx.readFile(filePath, {
            type: 'file',
            cellDates: true,  // Преобразование дат
            cellNF: true,     // Числовые форматы
            cellText: false   // Предпочитаем числовые значения для ячеек, а не текст
        });
        
        // Получаем первый лист
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Конвертируем лист в JSON
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log(`Файл успешно прочитан. Найдено ${data.length} строк.`);
        
        return processExcelData(data);
    } catch (error) {
        console.error('Ошибка при чтении Excel файла:', error.message);
        process.exit(1);
    }
}

// Функция для обработки данных из Excel
function processExcelData(data) {
    // Проверяем, что в файле есть данные
    if (!data || data.length < 2) {
        throw new Error('Excel файл пуст или содержит недостаточно данных.');
    }
    
    // Считаем, что первая строка - заголовки
    const headers = data[0];
    
    // Находим индексы нужных колонок
    const studentNameIndex = headers.findIndex(h => 
        typeof h === 'string' && h.toLowerCase().includes('ученик') || h.toLowerCase().includes('студент') || h.toLowerCase().includes('фио'));
    
    const studentIdIndex = headers.findIndex(h => 
        typeof h === 'string' && h.toLowerCase().includes('id') && h.toLowerCase().includes('ученик'));
    
    const subjectIndex = headers.findIndex(h => 
        typeof h === 'string' && h.toLowerCase().includes('предмет'));
    
    // Ищем колонки с четвертями
    const quarterColumns = headers.reduce((acc, header, index) => {
        if (typeof header === 'string') {
            const quarterMatch = header.match(/(\d)\s*-?я?\s*четверть/i);
            if (quarterMatch) {
                const quarter = parseInt(quarterMatch[1]);
                acc[quarter] = index;
            }
        }
        return acc;
    }, {});
    
    // Проверяем, что все необходимые колонки найдены
    if (studentNameIndex === -1 && studentIdIndex === -1) {
        throw new Error('Не найдена колонка с именем ученика или ID ученика.');
    }
    
    if (Object.keys(quarterColumns).length === 0) {
        throw new Error('Не найдены колонки с четвертями.');
    }
    
    console.log('Структура файла определена:');
    console.log('- Колонка с именем ученика:', studentNameIndex !== -1 ? headers[studentNameIndex] : 'Не найдена');
    console.log('- Колонка с ID ученика:', studentIdIndex !== -1 ? headers[studentIdIndex] : 'Не найдена');
    console.log('- Колонка с предметом:', subjectIndex !== -1 ? headers[subjectIndex] : 'Не найдена');
    console.log('- Найденные четверти:', Object.keys(quarterColumns).map(q => `${q}-я четверть (колонка: ${headers[quarterColumns[q]]})`).join(', '));
    
    // Формируем массив данных для загрузки
    const gradesToUpload = [];
    
    // Начиная со второй строки (данные)
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        // Пропускаем пустые строки
        if (!row || row.length === 0) continue;
        
        const studentName = studentNameIndex !== -1 ? row[studentNameIndex] : null;
        const studentId = studentIdIndex !== -1 ? row[studentIdIndex] : null;
        const subject = subjectIndex !== -1 ? row[subjectIndex] : null;
        
        // Если нет имени или ID, пропускаем строку
        if (!studentName && !studentId) continue;
        
        // Для каждой четверти добавляем оценку, если она есть
        for (const quarter in quarterColumns) {
            const gradeIndex = quarterColumns[quarter];
            const grade = row[gradeIndex];
            
            // Добавляем только если оценка есть и она от 2 до 5
            if (grade && typeof grade === 'number' && grade >= 2 && grade <= 5) {
                gradesToUpload.push({
                    studentName,
                    studentId,
                    subject,
                    quarter: parseInt(quarter),
                    grade
                });
            }
        }
    }
    
    console.log(`Подготовлено ${gradesToUpload.length} оценок для загрузки.`);
    return gradesToUpload;
}

// Функция для отправки запросов к API
async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
        const url = `${API_BASE_URL}${endpoint}`;
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Access-Token': accessToken
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.data = data;
        }
        
        const response = await axios(url, options);
        return response.data;
    } catch (error) {
        console.error('Ошибка при выполнении запроса к API:', error.message);
        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Ответ API:', error.response.data);
        }
        throw error;
    }
}

// Функция для получения списка классов
async function getClasses() {
    try {
        console.log('Получение списка классов...');
        const classes = await apiRequest('/schools/my/classes');
        
        if (!classes || !Array.isArray(classes) || classes.length === 0) {
            throw new Error('Не удалось получить список классов или список пуст.');
        }
        
        console.log(`Найдено ${classes.length} классов:`);
        classes.forEach((cls, index) => {
            console.log(`${index + 1}. ${cls.name} (ID: ${cls.id})`);
        });
        
        return classes;
    } catch (error) {
        console.error('Ошибка при получении списка классов:', error.message);
        process.exit(1);
    }
}

// Функция для получения списка учеников класса
async function getStudents(classId) {
    try {
        console.log(`Получение списка учеников для класса с ID ${classId}...`);
        const students = await apiRequest(`/classes/${classId}/persons`);
        
        if (!students || !Array.isArray(students) || students.length === 0) {
            throw new Error('Не удалось получить список учеников или список пуст.');
        }
        
        console.log(`Найдено ${students.length} учеников.`);
        return students;
    } catch (error) {
        console.error('Ошибка при получении списка учеников:', error.message);
        throw error;
    }
}

// Функция для получения списка предметов
async function getSubjects(classId) {
    try {
        console.log(`Получение списка предметов для класса с ID ${classId}...`);
        const subjects = await apiRequest(`/edu-groups/${classId}/subjects`);
        
        if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
            throw new Error('Не удалось получить список предметов или список пуст.');
        }
        
        console.log(`Найдено ${subjects.length} предметов.`);
        return subjects;
    } catch (error) {
        console.error('Ошибка при получении списка предметов:', error.message);
        throw error;
    }
}

// Функция для проверки наличия ученика по имени (упрощенно)
function findStudentByName(students, name) {
    // Простая проверка на включение имени
    return students.find(student => 
        student.firstName && student.lastName && 
        `${student.lastName} ${student.firstName}`.toLowerCase().includes(name.toLowerCase())
    );
}

// Функция для проверки наличия предмета по названию (упрощенно)
function findSubjectByName(subjects, name) {
    if (!name) return null;
    
    return subjects.find(subject => 
        subject.name && subject.name.toLowerCase().includes(name.toLowerCase())
    );
}

// Функция для создания или обновления оценки
async function createOrUpdateGrade(studentId, classId, subjectId, quarter, grade) {
    // Предполагаемая структура данных для создания оценки
    const gradeData = {
        person: studentId,
        subject: subjectId,
        value: grade,
        quarter: quarter,
        eduGroup: classId
        // Возможно здесь нужны дополнительные поля, зависит от API
    };
    
    try {
        // Предполагаемый эндпоинт для создания оценки (зависит от API)
        const result = await apiRequest('/marks', 'POST', gradeData);
        return result;
    } catch (error) {
        console.error(`Ошибка при создании оценки для ученика ${studentId}:`, error.message);
        throw error;
    }
}

// Основная функция для загрузки оценок
async function uploadGrades(gradesToUpload) {
    try {
        // Получаем список классов
        const classes = await getClasses();
        
        // Запрашиваем выбор класса у пользователя
        const classIndex = await new Promise((resolve) => {
            rl.question('Введите номер класса из списка: ', (answer) => {
                const index = parseInt(answer) - 1;
                if (isNaN(index) || index < 0 || index >= classes.length) {
                    console.error('Неверный номер класса.');
                    process.exit(1);
                }
                resolve(index);
            });
        });
        
        const selectedClass = classes[classIndex];
        console.log(`Выбран класс: ${selectedClass.name} (ID: ${selectedClass.id})`);
        
        // Получаем список учеников и предметов для выбранного класса
        const students = await getStudents(selectedClass.id);
        const subjects = await getSubjects(selectedClass.id);
        
        // Статистика загрузки
        const stats = {
            total: gradesToUpload.length,
            success: 0,
            failed: 0,
            skipped: 0
        };
        
        // Для каждой оценки пытаемся найти соответствия и загрузить
        for (const gradeInfo of gradesToUpload) {
            try {
                // Находим ученика
                let student;
                if (gradeInfo.studentId) {
                    // Если есть ID, ищем по нему
                    student = students.find(s => s.id === gradeInfo.studentId);
                } else if (gradeInfo.studentName) {
                    // Иначе ищем по имени
                    student = findStudentByName(students, gradeInfo.studentName);
                }
                
                if (!student) {
                    console.log(`Ученик не найден: ${gradeInfo.studentName || gradeInfo.studentId}. Пропускаем.`);
                    stats.skipped++;
                    continue;
                }
                
                // Находим предмет
                const subject = findSubjectByName(subjects, gradeInfo.subject);
                if (!subject) {
                    console.log(`Предмет не найден: ${gradeInfo.subject}. Пропускаем.`);
                    stats.skipped++;
                    continue;
                }
                
                // Создаем или обновляем оценку
                console.log(`Создание оценки: Ученик ${student.firstName} ${student.lastName}, Предмет: ${subject.name}, Четверть: ${gradeInfo.quarter}, Оценка: ${gradeInfo.grade}`);
                
                await createOrUpdateGrade(
                    student.id,
                    selectedClass.id,
                    subject.id,
                    gradeInfo.quarter,
                    gradeInfo.grade
                );
                
                stats.success++;
                console.log('Оценка успешно создана!');
            } catch (error) {
                console.error('Ошибка при создании оценки:', error.message);
                stats.failed++;
            }
        }
        
        // Выводим статистику
        console.log('\nСтатистика загрузки оценок:');
        console.log(`Всего оценок: ${stats.total}`);
        console.log(`Успешно загружено: ${stats.success}`);
        console.log(`Не загружено из-за ошибок: ${stats.failed}`);
        console.log(`Пропущено (не найдены соответствия): ${stats.skipped}`);
        
        console.log('\nЗагрузка оценок завершена!');
    } catch (error) {
        console.error('Ошибка при загрузке оценок:', error.message);
    } finally {
        rl.close();
    }
}

// Главная функция для запуска скрипта
async function main() {
    try {
        console.log('=== Скрипт для загрузки оценок из Excel в Kundelik.kz ===');
        
        // Получаем токен доступа
        accessToken = await authorize();
        
        // Читаем и обрабатываем Excel файл
        const gradesToUpload = readExcelFile();
        
        // Запрашиваем подтверждение у пользователя
        rl.question(`Будет загружено ${gradesToUpload.length} оценок. Продолжить? (y/n): `, async (answer) => {
            if (answer.toLowerCase() === 'y') {
                await uploadGrades(gradesToUpload);
            } else {
                console.log('Загрузка отменена пользователем.');
                rl.close();
            }
        });
    } catch (error) {
        console.error('Произошла ошибка:', error.message);
        rl.close();
    }
}

// Запускаем скрипт
main();
