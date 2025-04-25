javascript:(function() {
    // Простой букмарклет для подсчета оценок на текущей странице Kundelik.kz
    
    // Функция для подсчета оценок
    function countGrades() {
        // Получаем все оценки с текущей страницы
        const gradeElements = document.querySelectorAll('td:not(:empty):not([colspan])');
        
        // Подготавливаем объект для хранения статистики
        const statistics = {
            total: { '5': 0, '4': 0, '3': 0, '2': 0 },
            quarters: {
                '1': { '5': 0, '4': 0, '3': 0, '2': 0 },
                '2': { '5': 0, '4': 0, '3': 0, '2': 0 },
                '3': { '5': 0, '4': 0, '3': 0, '2': 0 },
                '4': { '5': 0, '4': 0, '3': 0, '2': 0 }
            }
        };
        
        // Определяем индексы колонок для каждой четверти
        const quarterIndices = {
            '1': [], // Индексы колонок для 1-ой четверти
            '2': [], // Индексы колонок для 2-ой четверти
            '3': [], // Индексы колонок для 3-ей четверти
            '4': []  // Индексы колонок для 4-ой четверти
        };
        
        // Находим заголовки таблицы для определения четвертей
        const headerCells = document.querySelectorAll('th');
        headerCells.forEach((cell, index) => {
            if (cell.textContent.includes('1 четверть')) {
                quarterIndices['1'].push(index);
            } else if (cell.textContent.includes('2 четверть')) {
                quarterIndices['2'].push(index);
            } else if (cell.textContent.includes('3 четверть')) {
                quarterIndices['3'].push(index);
            } else if (cell.textContent.includes('4 четверть')) {
                quarterIndices['4'].push(index);
            }
        });
        
        // Перебираем все ячейки с оценками
        let rows = document.querySelectorAll('tr');
        
        rows.forEach((row, rowIndex) => {
            // Пропускаем заголовки
            if (rowIndex === 0) return;
            
            const cells = row.querySelectorAll('td');
            
            cells.forEach((cell, cellIndex) => {
                const grade = cell.textContent.trim();
                
                // Проверяем, является ли содержимое ячейки оценкой (2, 3, 4 или 5)
                if (['2', '3', '4', '5'].includes(grade)) {
                    // Увеличиваем общий счетчик
                    statistics.total[grade]++;
                    
                    // Определяем, к какой четверти относится оценка
                    for (const quarter in quarterIndices) {
                        if (quarterIndices[quarter].includes(cellIndex)) {
                            statistics.quarters[quarter][grade]++;
                            break;
                        }
                    }
                }
            });
        });
        
        return statistics;
    }
    
    // Функция для отображения результатов
    function displayResults(statistics) {
        // Создаем контейнер для отображения результатов
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'grade-statistics';
        resultsContainer.style.position = 'fixed';
        resultsContainer.style.top = '50px';
        resultsContainer.style.right = '50px';
        resultsContainer.style.zIndex = '9999';
        resultsContainer.style.background = 'white';
        resultsContainer.style.padding = '20px';
        resultsContainer.style.border = '1px solid #ccc';
        resultsContainer.style.borderRadius = '5px';
        resultsContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
        resultsContainer.style.maxWidth = '400px';
        resultsContainer.style.maxHeight = '600px';
        resultsContainer.style.overflowY = 'auto';
        
        // Формируем HTML для отображения результатов
        let html = '<h3 style="margin-top:0">Статистика оценок</h3>';
        
        // Кнопка закрытия
        html += '<button id="close-stats" style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:16px;cursor:pointer;">✖</button>';
        
        // Общая статистика
        html += '<div style="margin-bottom:15px;"><h4 style="margin-bottom:5px">Всего оценок:</h4>';
        html += '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr>';
        html += '<th style="border:1px solid #ddd;padding:8px;text-align:center;background-color:#f2f2f2;">Оценка</th>';
        html += '<th style="border:1px solid #ddd;padding:8px;text-align:center;background-color:#f2f2f2;">Количество</th>';
        html += '</tr>';
        html += `<tr><td style="border:1px solid #ddd;padding:8px;text-align:center;">5</td><td style="border:1px solid #ddd;padding:8px;text-align:center;">${statistics.total['5'] || 0}</td></tr>`;
        html += `<tr><td style="border:1px solid #ddd;padding:8px;text-align:center;">4</td><td style="border:1px solid #ddd;padding:8px;text-align:center;">${statistics.total['4'] || 0}</td></tr>`;
        html += `<tr><td style="border:1px solid #ddd;padding:8px;text-align:center;">3</td><td style="border:1px solid #ddd;padding:8px;text-align:center;">${statistics.total['3'] || 0}</td></tr>`;
        html += `<tr><td style="border:1px solid #ddd;padding:8px;text-align:center;">2</td><td style="border:1px solid #ddd;padding:8px;text-align:center;">${statistics.total['2'] || 0}</td></tr>`;
        html += '</table></div>';
        
        // Статистика по четвертям
        html += '<div><h4 style="margin-bottom:5px">По четвертям:</h4>';
        html += '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr>';
        html += '<th style="border:1px solid #ddd;padding:8px;text-align:center;background-color:#f2f2f2;">Четверть</th>';
        html += '<th style="border:1px solid #ddd;padding:8px;text-align:center;background-color:#f2f2f2;">Оценка 5</th>';
        html += '<th style="border:1px solid #ddd;padding:8px;text-align:center;background-color:#f2f2f2;">Оценка 4</th>';
        html += '<th style="border:1px solid #ddd;padding:8px;text-align:center;background-color:#f2f2f2;">Оценка 3</th>';
        html += '<th style="border:1px solid #ddd;padding:8px;text-align:center;background-color:#f2f2f2;">Оценка 2</th>';
        html += '</tr>';
        
        for (let quarter = 1; quarter <= 4; quarter++) {
            html += `<tr>
                <td style="border:1px solid #ddd;padding:8px;text-align:center;">${quarter}-я</td>
                <td style="border:1px solid #ddd;padding:8px;text-align:center;">${statistics.quarters[quarter]['5'] || 0}</td>
                <td style="border:1px solid #ddd;padding:8px;text-align:center;">${statistics.quarters[quarter]['4'] || 0}</td>
                <td style="border:1px solid #ddd;padding:8px;text-align:center;">${statistics.quarters[quarter]['3'] || 0}</td>
                <td style="border:1px solid #ddd;padding:8px;text-align:center;">${statistics.quarters[quarter]['2'] || 0}</td>
            </tr>`;
        }
        
        html += '</table></div>';
        
        resultsContainer.innerHTML = html;
        document.body.appendChild(resultsContainer);
        
        // Добавляем обработчик для кнопки закрытия
        document.getElementById('close-stats').addEventListener('click', function() {
            document.body.removeChild(resultsContainer);
        });
    }
    
    // Проверяем, находимся ли мы на странице Kundelik
    if (window.location.hostname.includes('kundelik.kz')) {
        // Если уже есть контейнер со статистикой, удаляем его
        const existingContainer = document.getElementById('grade-statistics');
        if (existingContainer) {
            document.body.removeChild(existingContainer);
        }
        
        // Подсчитываем и отображаем статистику
        const statistics = countGrades();
        displayResults(statistics);
    } else {
        alert('Букмарклет работает только на сайте kundelik.kz');
    }
})();
