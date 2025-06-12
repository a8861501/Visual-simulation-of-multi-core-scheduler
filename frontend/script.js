let cores = [];
let tasks = [];
let socket;
let taskCounter = 1;

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
    taskDiv.innerHTML = `
        <h4>任務 ${taskCounter}</h4>
        <label>任務名稱:</label>
        <input type="text" id="task-name-${taskCounter}" value="Task ${taskCounter}">
        
        <label>執行時間 (秒):</label>
        <input type="number" id="task-time-${taskCounter}" value="5" min="1" max="100">
        
        <label>截止時間 (秒):</label>
        <input type="number" id="task-deadline-${taskCounter}" value="10" min="1" max="200">
        
        <button onclick="removeTask(${taskCounter})" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; margin-left: 10px; border-radius: 3px; cursor: pointer;">刪除</button>
    `;
    
    taskList.appendChild(taskDiv);
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
        const name = document.getElementById(`task-name-${taskId}`).value;
        const executionTime = parseInt(document.getElementById(`task-time-${taskId}`).value);
        const deadline = parseInt(document.getElementById(`task-deadline-${taskId}`).value);
        
        taskConfigs.push({
            name: name,
            execution_time: executionTime,
            deadline: deadline,
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
