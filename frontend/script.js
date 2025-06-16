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
    'P': { 
        name: 'P-Core (效能核心)', 
        color: '#e74c3c', 
        max_freq: 3.5, 
        min_freq: 1.2,
        base_power: 1.5,
        thermal_threshold: 85.0,
        description: '高效能核心，適合計算密集任務'
    },
    'E': { 
        name: 'E-Core (節能核心)', 
        color: '#2ecc71', 
        max_freq: 2.0, 
        min_freq: 0.8,
        base_power: 0.6,
        thermal_threshold: 75.0,
        description: '節能核心，適合背景任務'
    }
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
      socket.on('core_states_update', function(data) {
        updateCoreStates(data.cores, data.time);
        updateSimulationTime(data.time, data.remaining_time);
    });
    
    socket.on('task_assigned', function(data) {
        moveTaskToCore(data.task_id, data.core_id, data.task);
    });
    
    socket.on('task_completed', function(data) {
        removeCompletedTask(data.task_id, data.task_name);
    });
      socket.on('simulation_complete', function(data) {
        displayEnhancedStatistics(data.statistics, data.timeout);
        document.getElementById('execute-btn').disabled = false;
        document.getElementById('execute-btn').textContent = '執行排程';
        
        if (data.timeout) {
            showTimeoutMessage(data.total_time);
        }
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
                <option value="P" selected>P-Core (效能核心)</option>
                <option value="E">E-Core (節能核心)</option>
            </select>
            <div class="core-details" id="core-details-${i}">
                <span class="core-spec">頻率: 1.2-3.5 GHz | 功耗: 1.5W | 溫度閾值: 85°C</span>
            </div>
        `;
        paramContainer.appendChild(paramDiv);
        
        // Visual representation
        const coreDiv = document.createElement('div');
        coreDiv.className = 'core-visual idle';
        coreDiv.id = `core-${i}`;
        coreDiv.style.backgroundColor = coreTypes['P'].color;        coreDiv.innerHTML = `
            <div class="core-id">P-Core ${i + 1}</div>
            <div class="core-stats">
                <div class="stat">Load: <span id="load-${i}">0%</span></div>
                <div class="stat">Temp: <span id="temp-${i}">25°C</span></div>
                <div class="stat">Freq: <span id="freq-${i}">3.5GHz</span></div>
                <div class="stat">Power: <span id="power-${i}">1.5W</span></div>
            </div>
            <div class="current-task"></div>
            <div class="task-queue" id="task-queue-${i}">
                <div class="queue-header">任務佇列:</div>
            </div>
        `;
        visualContainer.appendChild(coreDiv);
        
        // Initialize core data
        cores.push({
            id: i,
            core_type: 'P'
        });
    }
}

function updateCoreType(coreIndex) {
    const typeSelect = document.getElementById(`core-type-${coreIndex}`);
    const coreVisual = document.getElementById(`core-${coreIndex}`);
    const coreDetails = document.getElementById(`core-details-${coreIndex}`);
    
    const selectedType = typeSelect.value;
    const typeConfig = coreTypes[selectedType];
    
    // Update visual
    coreVisual.style.backgroundColor = typeConfig.color;
    coreVisual.querySelector('.core-id').textContent = `${selectedType}-Core ${coreIndex + 1}`;
    
    // Update details display
    coreDetails.querySelector('.core-spec').textContent = 
        `頻率: ${typeConfig.min_freq}-${typeConfig.max_freq} GHz | 功耗: ${typeConfig.base_power}W | 溫度閾值: ${typeConfig.thermal_threshold}°C`;
    
    // Update frequency display
    const freqSpan = document.getElementById(`freq-${coreIndex}`);
    if (freqSpan) {
        freqSpan.textContent = `${typeConfig.max_freq}GHz`;
    }
    
    // Update core data
    cores[coreIndex] = {
        id: coreIndex,
        core_type: selectedType
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
        
        <button onclick="removeTask(${taskCounter})" class="remove-btn">刪除 任務</button>
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

function executeScheduling() {    // Collect core configurations
    const coreConfigs = [];
    for (let i = 0; i < cores.length; i++) {
        const coreType = document.getElementById(`core-type-${i}`).value;
        coreConfigs.push({
            core_type: coreType
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
    });    // Get selected strategy
    const strategy = document.querySelector('input[name="strategy"]:checked').value;
    
    // Get max simulation time
    const maxSimTime = parseInt(document.getElementById('max-sim-time').value) || 60;
    
    // Clear previous statistics
    document.getElementById('statistics').innerHTML = '<div class="stats-loading">正在執行排程...</div>';
    
    // Clear task queues
    document.querySelectorAll('.task-queue').forEach(queue => {
        queue.innerHTML = '<div class="queue-header">任務佇列:</div>';
    });
    
    // Disable execute button
    document.getElementById('execute-btn').disabled = true;
    document.getElementById('execute-btn').textContent = '執行中...';
    
    // Choose API endpoint based on strategy
    const endpoint = strategy === 'BASIC' ? '/api/execute_realtime' : '/api/execute';
      // Send request to backend
    fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            cores: coreConfigs,
            tasks: taskConfigs,
            strategy: strategy,
            max_simulation_time: maxSimTime
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

function updateCoreStates(cores, currentTime) {
    cores.forEach(core => {
        const coreElement = document.getElementById(`core-${core.core_id}`);
        if (coreElement) {
            // Update statistics
            document.getElementById(`load-${core.core_id}`).textContent = `${core.load}%`;
            document.getElementById(`temp-${core.core_id}`).textContent = `${core.temp}°C`;
            document.getElementById(`freq-${core.core_id}`).textContent = `${core.freq}GHz`;
            document.getElementById(`power-${core.core_id}`).textContent = `${core.power}W`;
            
            // Update visual state
            const taskElement = coreElement.querySelector('.current-task');
            if (core.active && core.current_task) {
                coreElement.className = 'core-visual running';
                taskElement.textContent = `執行中: ${core.current_task}`;
                
                // Add thermal throttling indicator
                if (core.thermal_throttling) {
                    coreElement.classList.add('thermal-throttling');
                }
            } else {
                coreElement.className = 'core-visual idle';
                taskElement.textContent = '閒置';
                coreElement.classList.remove('thermal-throttling');
            }
        }
    });
    
    // Update time display
    const timeDisplay = document.getElementById('current-time');
    if (timeDisplay) {
        timeDisplay.textContent = `模擬時間: ${currentTime.toFixed(1)}s`;
    }
}

function moveTaskToCore(taskId, coreId, taskName) {
    const taskQueue = document.getElementById(`task-queue-${coreId}`);
    if (taskQueue) {
        const taskElement = document.createElement('div');
        taskElement.className = 'queued-task';
        taskElement.id = `queued-task-${taskId}`;
        taskElement.innerHTML = `
            <span class="task-name">${taskName}</span>
            <span class="task-status">執行中</span>
        `;
        taskQueue.appendChild(taskElement);
    }
}

function removeCompletedTask(taskId, taskName) {
    const taskElement = document.getElementById(`queued-task-${taskId}`);
    if (taskElement) {
        taskElement.classList.add('completed');
        setTimeout(() => {
            taskElement.remove();
        }, 1000); // 1秒後移除
    }
}

function updateSimulationTime(currentTime, remainingTime) {
    const timeDisplay = document.getElementById('current-time');
    if (timeDisplay) {
        timeDisplay.innerHTML = `
            <span class="current-time">模擬時間: ${currentTime.toFixed(1)}s</span>
            <span class="remaining-time">剩餘時間: ${remainingTime.toFixed(1)}s</span>
        `;
        
        // 添加時間警告
        if (remainingTime < 10) {
            timeDisplay.classList.add('time-warning');
        } else {
            timeDisplay.classList.remove('time-warning');
        }
    }
}

function showTimeoutMessage(totalTime) {
    const message = document.createElement('div');
    message.className = 'timeout-message';
    message.innerHTML = `
        <h3>⏰ 模擬時間到達上限</h3>
        <p>模擬在 ${totalTime.toFixed(1)} 秒後自動停止</p>
        <p>所有正在執行的任務已被中斷</p>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(message, container.firstChild);
    
    // 5秒後自動移除訊息
    setTimeout(() => {
        message.remove();
    }, 5000);
}

function displayEnhancedStatistics(statistics, timeout) {
    const statsContainer = document.getElementById('statistics');
    statsContainer.innerHTML = '';
    
    if (!statistics) return;
    
    // 創建統計標籤頁
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'stats-tabs';
    tabsContainer.innerHTML = `
        <button class="tab-button active" onclick="showStatsTab('global')">全域統計</button>
        <button class="tab-button" onclick="showStatsTab('cores')">核心統計</button>
    `;
    statsContainer.appendChild(tabsContainer);
    
    // 全域統計
    const globalStatsDiv = document.createElement('div');
    globalStatsDiv.className = 'stats-content active';
    globalStatsDiv.id = 'global-stats';
    
    const global = statistics.global;
    globalStatsDiv.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card ${timeout ? 'timeout' : 'success'}">
                <h4>模擬結果</h4>
                <p><strong>執行時間:</strong> ${global.simulation_time}s</p>
                <p><strong>狀態:</strong> ${timeout ? '時間到達上限' : '正常完成'}</p>
                <p><strong>任務完成率:</strong> ${global.completion_rate}%</p>
            </div>
            
            <div class="stat-card">
                <h4>任務統計</h4>
                <p><strong>總任務數:</strong> ${global.total_tasks}</p>
                <p><strong>已分配:</strong> ${global.tasks_assigned}</p>
                <p><strong>已完成:</strong> ${global.tasks_completed}</p>
            </div>
            
            <div class="stat-card">
                <h4>系統效能</h4>
                <p><strong>平均溫度:</strong> ${global.avg_system_temperature}°C</p>
                <p><strong>總功耗:</strong> ${global.total_system_power.toFixed(2)}W·s</p>
                <p><strong>限速事件:</strong> ${global.thermal_throttling_events}</p>
            </div>
        </div>
    `;
    statsContainer.appendChild(globalStatsDiv);
    
    // 核心統計
    const coreStatsDiv = document.createElement('div');
    coreStatsDiv.className = 'stats-content';
    coreStatsDiv.id = 'core-stats';
    
    let coreStatsHTML = '<div class="core-stats-grid">';
    statistics.cores.forEach(core => {
        coreStatsHTML += `
            <div class="core-stat-card">
                <h4>${core.core_type}-Core ${core.core_id + 1}</h4>
                <div class="stat-row">
                    <span>利用率:</span>
                    <span class="stat-value">${core.utilization_percentage}%</span>
                </div>
                <div class="stat-row">
                    <span>活躍時間:</span>
                    <span class="stat-value">${core.active_time}s</span>
                </div>
                <div class="stat-row">
                    <span>閒置時間:</span>
                    <span class="stat-value">${core.idle_time}s</span>
                </div>
                <div class="stat-row">
                    <span>最終溫度:</span>
                    <span class="stat-value">${core.final_temperature}°C</span>
                </div>
                <div class="stat-row">
                    <span>平均頻率:</span>
                    <span class="stat-value">${core.avg_frequency}GHz</span>
                </div>
                <div class="stat-row">
                    <span>執行任務數:</span>
                    <span class="stat-value">${core.tasks_executed}</span>
                </div>
            </div>
        `;
    });
    coreStatsHTML += '</div>';
    coreStatsDiv.innerHTML = coreStatsHTML;
    statsContainer.appendChild(coreStatsDiv);
}

function showStatsTab(tabName) {
    // 移除所有active類別
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.stats-content').forEach(content => content.classList.remove('active'));
    
    // 添加active到選中的標籤
    event.target.classList.add('active');
    document.getElementById(`${tabName}-stats`).classList.add('active');
}
