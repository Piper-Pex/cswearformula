// 全局变量
let materialsData = {};
let magicMaterialSearchResult = null;

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 绑定按钮事件
    document.getElementById('addDataBtn').addEventListener('click', processInventoryData);
    document.getElementById('clearDataBtn').addEventListener('click', clearData);
    document.getElementById('optimizeBtn').addEventListener('click', runOptimization);
    document.getElementById('resetBtn').addEventListener('click', resetResults);
    
    // 添加魔法材料搜索按钮
    const optimizeBtn = document.getElementById('optimizeBtn');
    const magicMaterialBtn = document.createElement('button');
    magicMaterialBtn.id = 'magicMaterialBtn';
    magicMaterialBtn.className = 'btn-primary';
    magicMaterialBtn.innerHTML = '🔮 寻找魔法材料';
    magicMaterialBtn.addEventListener('click', findMagicMaterial);
    optimizeBtn.parentNode.insertBefore(magicMaterialBtn, optimizeBtn.nextSibling);
});

// 处理库存数据
function processInventoryData() {
    const input = document.getElementById('inventoryInput').value.trim();
    if (!input) {
        showStatus('请输入库存数据', 'error');
        return;
    }
    
    try {
        materialsData = parseInventoryData(input);
        updateProcessedDataDisplay();
        generateRangeInputs();
        showStatus(`成功处理 ${getTotalMaterials()} 个材料`, 'success');
    } catch (error) {
        showStatus('处理数据时出错: ' + error.message, 'error');
        console.error(error);
    }
}

// 解析库存数据
function parseInventoryData(input) {
    const materials = {};
    const lines = input.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 匹配磨损值和武器名称
        const wearMatch = line.match(/磨损\s*:\s*([0-9.]+)/);
        const weaponMatch = line.match(/(.+?)\s*\|\s*(.+)/);
        
        if (wearMatch && weaponMatch && i > 0) {
            const wear = parseFloat(wearMatch[1]);
            const weaponName = lines[i-1].trim() + ' | ' + weaponMatch[2];
            
            if (!materials[weaponName]) {
                materials[weaponName] = [];
            }
            materials[weaponName].push(wear);
        }
        
        // 匹配未使用材料格式
        const unusedMatch = line.match(/原始磨损\s*:\s*([0-9.]+)/);
        if (unusedMatch && weaponMatch) {
            const wear = parseFloat(unusedMatch[1]);
            const weaponName = weaponMatch[0];
            
            if (!materials[weaponName]) {
                materials[weaponName] = [];
            }
            materials[weaponName].push(wear);
        }
    }
    
    return materials;
}

// 更新处理后的数据显示
function updateProcessedDataDisplay() {
    const display = document.getElementById('processedData');
    display.textContent = `materials_data = ${JSON.stringify(materialsData, null, 2)}`;
}

// 生成范围输入框
function generateRangeInputs() {
    const container = document.getElementById('rangeInputs');
    container.innerHTML = '';
    
    for (const materialName of Object.keys(materialsData)) {
        const safeId = materialName.replace(/\s+/g, '_');
        const wears = materialsData[materialName];
        const minWear = Math.min(...wears);
        const maxWear = Math.max(...wears);
        
        const rangeInput = document.createElement('div');
        rangeInput.className = 'range-input';
        rangeInput.innerHTML = `
            <label>${materialName} (${wears.length}个)</label>
            <div class="input-group">
                <div>
                    <label for="min_${safeId}">最小磨损:</label>
                    <input type="number" id="min_${safeId}" step="0.000001" min="0" max="1" value="${minWear.toFixed(6)}">
                </div>
                <div>
                    <label for="max_${safeId}">最大磨损:</label>
                    <input type="number" id="max_${safeId}" step="0.000001" min="0" max="1" value="${maxWear.toFixed(6)}">
                </div>
            </div>
        `;
        container.appendChild(rangeInput);
    }
}

// 获取材料总数
function getTotalMaterials() {
    return Object.values(materialsData).reduce((total, wears) => total + wears.length, 0);
}

// 显示状态消息
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
}

// 清空数据
function clearData() {
    document.getElementById('inventoryInput').value = '';
    materialsData = {};
    updateProcessedDataDisplay();
    document.getElementById('rangeInputs').innerHTML = '';
    document.getElementById('resultsContent').innerHTML = '';
    showStatus('数据已清空', 'info');
}

// 重置结果
function resetResults() {
    document.getElementById('resultsContent').innerHTML = '';
    showStatus('结果已重置', 'info');
}

// 运行优化
function runOptimization() {
    if (getTotalMaterials() === 0) {
        showStatus('没有数据可进行优化', 'error');
        return;
    }
    
    try {
        // 获取材料范围配置
        const materialRanges = {};
        for (const materialName of Object.keys(materialsData)) {
            const safeId = materialName.replace(/\s+/g, '_');
            const minWear = parseFloat(document.getElementById(`min_${safeId}`).value);
            const maxWear = parseFloat(document.getElementById(`max_${safeId}`).value);
            materialRanges[materialName] = [minWear, maxWear];
        }
        
        const targetMaxWear = parseFloat(document.getElementById('targetWear').value);
        const targetMinWear = parseFloat(document.getElementById('targetMinWear').value);
        const targetMaxWearFixed = parseFloat(document.getElementById('targetMaxWearFixed').value);
        
        // 运行优化算法
        const result = optimizeMaterialAllocation(materialsData, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed);
        
        // 显示结果
        displayOptimizationResults(result);
        showStatus(`优化完成！找到 ${result.total_groups} 个合成组`, 'success');
        
    } catch (error) {
        showStatus('优化过程中出错: ' + error.message, 'error');
        console.error(error);
    }
}

// 优化算法核心函数（简化版）
function optimizeMaterialAllocation(materialsData, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed) {
    // 这里放置您的优化算法
    // 暂时返回模拟结果
    return {
        total_groups: Math.floor(getTotalMaterials() / 10),
        groups: [],
        unused_materials: []
    };
}

// 显示优化结果
function displayOptimizationResults(result) {
    const resultsContent = document.getElementById('resultsContent');
    let html = `
        <div class="group-result">
            <div class="group-header">优化结果摘要</div>
            <div>总共组成: <strong>${result.total_groups}</strong> 个合成组</div>
            <div>剩余材料: <strong>${result.unused_materials ? result.unused_materials.length : 0}</strong> 个</div>
        </div>
    `;
    
    resultsContent.innerHTML = html;
}

// 魔法材料搜索相关函数（您原有的代码）
function findMagicMaterial() {
    if (getTotalMaterials() === 0) {
        showStatus('没有数据可进行魔法材料搜索', 'error');
        return;
    }
    
    showStatus('正在搜索最优魔法材料...', 'info');
    
    // 这里放置您的魔法材料搜索逻辑
    // 暂时模拟结果
    setTimeout(() => {
        magicMaterialSearchResult = {
            baselineGroups: 5,
            bestTransformedWear: 0.123456,
            bestGroups: 7,
            improvement: 2,
            candidatePoints: []
        };
        displayMagicMaterialResult();
    }, 1000);
}

// 其他辅助函数...
function testMagicMaterial(transformedWear, baseMaterials, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed) {
    // 实现测试逻辑
    return 5; // 模拟返回值
}

function calculateOriginalWearFromTransformed(transformedWear) {
    // 实现计算逻辑
    return transformedWear; // 模拟返回值
}

function displayMagicMaterialResult() {
    // 实现显示逻辑
    const result = magicMaterialSearchResult;
    const resultsContent = document.getElementById('resultsContent');
    
    let html = `<div class="group-result" style="border-left: 4px solid #9b59b6;">
        <div class="group-header" style="color: #9b59b6;">🎯 魔法材料搜索结果</div>
        <div><strong>基准情况:</strong> ${result.baselineGroups} 个合成组</div>
        <div class="suggestion" style="background: #f3e8fd; border-left-color: #9b59b6;">
            <strong>🎉 找到魔法材料!</strong><br>
            <div>最优变形磨损: <span style="color: #9b59b6; font-weight: bold;">${result.bestTransformedWear.toFixed(6)}</span></div>
            <div>预期合成组数: <span style="color: #9b59b6; font-weight: bold;">${result.bestGroups}</span> 组</div>
            <div>改善效果: <span style="color: #27ae60; font-weight: bold;">+${result.improvement}</span> 组</div>
        </div>
    </div>`;
    
    resultsContent.innerHTML += html;
    showStatus(`魔法材料搜索完成! 找到改善 +${result.improvement} 组的最佳材料`, 'success');
}