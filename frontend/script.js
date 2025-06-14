let cores = [];
let tasks = [];
let socket;
let taskCounter = 1;

// Task type configurations
const taskTypes = {
    'browser': { 
        name: '瀏覽器任務', 
        icon: '🌐',
        description: '網頁瀏覽、JavaScript執行',
        color: '#3498db'
    },
    'game': { 
        name: '遊戲任務', 
        icon: '🎮',
        description: '遊戲渲染、實時處理',
        color: '#e74c3c'
    },
    'music': { 
        name: '音樂播放', 
        icon: '🎵',
        description: '音頻解碼、播放',
        color: '#2ecc71'
    },
    'video_encode': { 
        name: '影片轉檔', 
        icon: '🎬',
        description: '影片處理、編碼',
        color: '#f39c12'
    },
    'typing': { 
        name: '文字輸入', 
        icon: '⌨️',
        description: '文字處理、輸入響應',
        color: '#9b59b6'
    },
    'spotify': { 
        name: 'Spotify 音樂', 
        icon: '🎧',
        description: '串流音樂播放',
        color: '#1db954'
    },
    'video_call': { 
        name: '視訊通話', 
        icon: '📹',
        description: '即時視訊通訊',
        color: '#ff6b6b'
    },
    'file_download': { 
        name: '檔案下載', 
        icon: '📥',
        description: '網路檔案下載',
        color: '#4ecdc4'
    },
    'ai_processing': { 
        name: 'AI 運算/機器學習', 
        icon: '🧠',
        description: 'AI 模型推理、機器學習',
        color: '#a29bfe'
    },
    'system_backup': { 
        name: '系統備份', 
        icon: '💾',
        description: '資料備份、同步',
        color: '#6c5ce7'
    },
    'photo_editing': { 
        name: '圖片編輯', 
        icon: '🖼️',
        description: '影像處理、修圖',
        color: '#fd79a8'
    }
};

// Core type configurations
const coreTypes = {
    'high-performance': { color: '#e74c3c', frequency: 3.0, power: 15 },
    'balanced': { color: '#3498db', frequency: 2.5, power: 10 },
    'efficiency': { color: '#2ecc71', frequency: 2.0, power: 5 }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    updateCoreConfig();
    addTask(); // Add first task by default
    initializeSocket();
});

function initializeSocket() {
    socket = io('http://localhost:5000');
    
    socket.on('core_update', function(data) {
        updateCoreVisual(data.core_id, data.status, data.task);
    });
    
    socket.on('simulation_complete', function(data) {
        displayStatistics(data.statistics);
        document.getElementById('execute-btn').disabled = false;
        document.getElementById('execute-btn').textContent = '執行排程';
    });
}

function updateCoreConfig() {
    const coreCount = parseInt(document.getElementById('core-count').value);
    const paramContainer = document.getElementById('core-parameters');
    const visualContainer = document.getElementById('core-visualization');
    
    // Clear existing configurations
    paramContainer.innerHTML = '';
    visualContainer.innerHTML = '';
    cores = [];
    
    // Create core parameter inputs
    for (let i = 0; i < coreCount; i++) {
        // Parameter configuration
        const paramDiv = document.createElement('div');
        paramDiv.className = 'core-param';
        paramDiv.innerHTML = `
            <label>核心 ${i + 1}:</label>
            <select onchange="updateCoreType(${i})" id="core-type-${i}">
                <option value="high-performance">高效能核心</option>
                <option value="balanced" selected>平衡核心</option>
                <option value="efficiency">節能核心</option>
            </select>
            <label>頻率 (GHz):</label>
            <input type="number" id="frequency-${i}" value="2.5" step="0.1" min="1.0" max="5.0">
            <label>功耗係數:</label>
            <input type="number" id="power-${i}" value="10" step="1" min="1" max="50">
        `;
        paramContainer.appendChild(paramDiv);
        
        // Visual representation
        const coreDiv = document.createElement('div');
        coreDiv.className = 'core-visual idle';
        coreDiv.id = `core-${i}`;
        coreDiv.style.backgroundColor = coreTypes['balanced'].color;
        coreDiv.innerHTML = `
            <div class="core-id">核心 ${i + 1}</div>
            <div class="current-task"></div>
        `;
        visualContainer.appendChild(coreDiv);
        
        // Initialize core data
        cores.push({
            id: i,
            type: 'balanced',
            frequency: 2.5,
            power_coefficient: 10
        });
    }
}

function updateCoreType(coreIndex) {
    const typeSelect = document.getElementById(`core-type-${coreIndex}`);
    const frequencyInput = document.getElementById(`frequency-${coreIndex}`);
    const powerInput = document.getElementById(`power-${coreIndex}`);
    const coreVisual = document.getElementById(`core-${coreIndex}`);
    
    const selectedType = typeSelect.value;
    const typeConfig = coreTypes[selectedType];
    
    // Update input values
    frequencyInput.value = typeConfig.frequency;
    powerInput.value = typeConfig.power;
    
    // Update visual color
    coreVisual.style.backgroundColor = typeConfig.color;
    
    // Update core data
    cores[coreIndex] = {
        id: coreIndex,
        type: selectedType,
        frequency: typeConfig.frequency,
        power_coefficient: typeConfig.power
    };
}

function addTask() {
    const taskList = document.getElementById('task-list');
    
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-item';
    taskDiv.id = `task-${taskCounter}`;
    
    // Create task type selector
    let taskTypeOptions = '';
    for (const [key, config] of Object.entries(taskTypes)) {
        taskTypeOptions += `<option value="${key}">${config.icon} ${config.name}</option>`;
    }
    
    taskDiv.innerHTML = `
        <h4>任務 ${taskCounter}</h4>
        <div class="task-config-row">
            <label>任務類型:</label>
            <select id="task-type-${taskCounter}" onchange="updateTaskPreview(${taskCounter})">
                ${taskTypeOptions}
            </select>
        </div>
        
        <div class="task-config-row">
            <label>自訂名稱 (可選):</label>
            <input type="text" id="task-name-${taskCounter}" placeholder="留空使用預設名稱">
        </div>
        
        <div class="task-config-row">
            <label>到達時間 (秒):</label>
            <input type="number" id="task-arrival-${taskCounter}" value="0" min="0" max="100">
        </div>
        
        <div class="task-preview" id="task-preview-${taskCounter}">
            <h5>任務預覽:</h5>
            <div class="preview-content"></div>
        </div>
        
        <button onclick="removeTask(${taskCounter})" class="remove-btn">刪除任務</button>
    `;
    
    taskList.appendChild(taskDiv);
    updateTaskPreview(taskCounter);
    taskCounter++;
}

function removeTask(taskId) {
    const taskElement = document.getElementById(`task-${taskId}`);
    if (taskElement) {
        taskElement.remove();
    }
}

function updateCoreVisual(coreId, status, taskName = null) {
    const coreElement = document.getElementById(`core-${coreId}`);
    const taskElement = coreElement.querySelector('.current-task');
    
    coreElement.className = `core-visual ${status}`;
    
    if (status === 'running' && taskName) {
        taskElement.textContent = taskName;
    } else {
        taskElement.textContent = '';
    }
}

function executeScheduling() {
    // Collect core configurations
    const coreConfigs = [];
    for (let i = 0; i < cores.length; i++) {
        coreConfigs.push({
            frequency: parseFloat(document.getElementById(`frequency-${i}`).value),
            power_coefficient: parseFloat(document.getElementById(`power-${i}`).value)
        });
    }
      // Collect task configurations
    const taskConfigs = [];
    const taskElements = document.querySelectorAll('.task-item');
    taskElements.forEach((element, index) => {
        const taskId = element.id.split('-')[1];
        const taskType = document.getElementById(`task-type-${taskId}`).value;
        const customName = document.getElementById(`task-name-${taskId}`).value.trim();
        const arrivalTime = parseInt(document.getElementById(`task-arrival-${taskId}`).value) || 0;
        
        taskConfigs.push({
            task_type: taskType,
            name: customName || null, // null means use default name
            arrival_time: arrivalTime,
            dependencies: []
        });
    });
    
    // Get selected strategy
    const strategy = document.querySelector('input[name="strategy"]:checked').value;
    
    // Clear previous statistics
    document.getElementById('statistics').innerHTML = '';
    
    // Disable execute button
    document.getElementById('execute-btn').disabled = true;
    document.getElementById('execute-btn').textContent = '執行中...';
    
    // Send request to backend
    fetch('http://localhost:5000/api/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            cores: coreConfigs,
            tasks: taskConfigs,
            strategy: strategy
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Scheduling started:', data);
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('execute-btn').disabled = false;
        document.getElementById('execute-btn').textContent = '執行排程';
    });
}

function displayStatistics(statistics) {
    const statsContainer = document.getElementById('statistics');
    statsContainer.innerHTML = '';
    
    statistics.forEach(stat => {
        const statDiv = document.createElement('div');
        statDiv.className = 'stat-item';
        statDiv.innerHTML = `
            <h4>核心 ${stat.core_id + 1}</h4>
            <p><strong>總執行時間:</strong> ${stat.total_execution_time.toFixed(2)} 秒</p>
            <p><strong>總功耗:</strong> ${stat.total_power_consumption.toFixed(2)} 瓦特</p>
        `;
        statsContainer.appendChild(statDiv);
    });
}

function resetSimulation() {
    // Reset all core visuals to idle state
    const coreElements = document.querySelectorAll('.core-visual');
    coreElements.forEach(element => {
        element.className = 'core-visual idle';
        element.querySelector('.current-task').textContent = '';
    });
    
    // Clear statistics
    document.getElementById('statistics').innerHTML = '';
    
    // Enable execute button
    document.getElementById('execute-btn').disabled = false;
    document.getElementById('execute-btn').textContent = '執行排程';
}

function updateTaskPreview(taskId) {
    const taskType = document.getElementById(`task-type-${taskId}`).value;
    const previewDiv = document.getElementById(`task-preview-${taskId}`);
    const previewContent = previewDiv.querySelector('.preview-content');
    
    const taskConfig = taskTypes[taskType];
      // Task type specific configurations (matching backend configurations)
    const taskParams = {
        'browser': {
            cpu_burst: 80,
            deadline_offset: 30,
            priority_class: 'NORMAL',
            thread_priority: 'ABOVE_NORMAL',
            realtime: false
        },
        'game': {
            cpu_burst: 150,
            deadline_offset: 10,
            priority_class: 'REALTIME',
            thread_priority: 'TIME_CRITICAL',
            realtime: true
        },
        'music': {
            cpu_burst: 40,
            deadline_offset: 50,
            priority_class: 'IDLE',
            thread_priority: 'LOWEST',
            realtime: true
        },
        'video_encode': {
            cpu_burst: 200,
            deadline_offset: 60,
            priority_class: 'HIGH',
            thread_priority: 'HIGHEST',
            realtime: false
        },
        'typing': {
            cpu_burst: 30,
            deadline_offset: 40,
            priority_class: 'NORMAL',
            thread_priority: 'NORMAL',
            realtime: false
        },
        'spotify': {
            cpu_burst: 40,
            deadline_offset: 50,
            priority_class: 'IDLE',
            thread_priority: 'LOWEST',
            realtime: true
        },
        'video_call': {
            cpu_burst: 120,
            deadline_offset: 8,
            priority_class: 'REALTIME',
            thread_priority: 'HIGHEST',
            realtime: true
        },
        'file_download': {
            cpu_burst: 25,
            deadline_offset: 100,
            priority_class: 'NORMAL',
            thread_priority: 'BELOW_NORMAL',
            realtime: false
        },
        'ai_processing': {
            cpu_burst: 300,
            deadline_offset: 30,
            priority_class: 'HIGH',
            thread_priority: 'ABOVE_NORMAL',
            realtime: false
        },
        'system_backup': {
            cpu_burst: 50,
            deadline_offset: 300,
            priority_class: 'IDLE',
            thread_priority: 'LOWEST',
            realtime: false
        },
        'photo_editing': {
            cpu_burst: 180,
            deadline_offset: 45,
            priority_class: 'NORMAL',
            thread_priority: 'NORMAL',
            realtime: false
        }
    };
    
    const params = taskParams[taskType];
    const arrivalTime = parseInt(document.getElementById(`task-arrival-${taskId}`).value) || 0;
    
    previewContent.innerHTML = `
        <div class="preview-item">
            <span class="preview-label">描述:</span>
            <span class="preview-value">${taskConfig.description}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">CPU突發:</span>
            <span class="preview-value">${params.cpu_burst}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">截止時間:</span>
            <span class="preview-value">${arrivalTime + params.deadline_offset} 秒</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">優先級:</span>
            <span class="preview-value">${params.priority_class}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">實時任務:</span>
            <span class="preview-value">${params.realtime ? '是' : '否'}</span>
        </div>
    `;
    
    // Update preview background color
    previewDiv.style.borderLeft = `4px solid ${taskConfig.color}`;
}
