// 全局变量
let materialsData = {};
let materialOrderTracker = {};
let materialCurrentOrders = {}; // 改为每种材料独立的计数器
let lastOptimizationResult = null;
let magicMaterialSearchResult = null; // 添加魔法材料搜索结果

// 数据预处理函数 - 支持两种格式
function parseInventoryData(inputText) {
    console.log("开始解析数据...");
    const lines = inputText.trim().split('\n');
    let localMaterialsData = {};
    let localOrderTracker = {};
    let localCurrentOrders = {...materialCurrentOrders}; // 复制当前计数器状态
    
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        
        // 格式1: 原始库存网站格式
        if (line.startsWith('磨损:')) {
            const wearValue = parseFloat(line.replace('磨损:', '').trim());
            
            if (i + 1 < lines.length) {
                let weaponLine = lines[i + 1].trim();
                
                // 清理武器名称，去掉括号内的磨损描述
                if (weaponLine.includes('(')) {
                    weaponLine = weaponLine.split('(')[0].trim();
                }
                
                // 初始化数据结构和计数器
                if (!localMaterialsData[weaponLine]) {
                    localMaterialsData[weaponLine] = [];
                    localOrderTracker[weaponLine] = [];
                    if (!localCurrentOrders[weaponLine]) {
                        localCurrentOrders[weaponLine] = 1;
                    }
                }
                
                // 添加磨损值和顺序
                localMaterialsData[weaponLine].push(wearValue);
                localOrderTracker[weaponLine].push(localCurrentOrders[weaponLine]);
                localCurrentOrders[weaponLine]++;
                
                i++; // 跳过武器名称行
            }
        }
        // 格式2: 未使用材料格式 (包含"原始磨损:"和武器名称标题)
        else if (line.includes('原始磨损:') && i > 0) {
            // 检查前一行是否是武器名称
            const prevLine = i > 0 ? lines[i-1].trim() : '';
            if (prevLine && !prevLine.includes('原始磨损:') && !prevLine.includes('未使用材料') && !prevLine.includes('归一化磨损')) {
                // 提取磨损值
                const wearMatch = line.match(/原始磨损:\s*([0-9.]+)/);
                if (wearMatch) {
                    const wearValue = parseFloat(wearMatch[1]);
                    const weaponName = prevLine;
                    
                    // 初始化数据结构和计数器
                    if (!localMaterialsData[weaponName]) {
                        localMaterialsData[weaponName] = [];
                        localOrderTracker[weaponName] = [];
                        if (!localCurrentOrders[weaponName]) {
                            localCurrentOrders[weaponName] = 1;
                        }
                    }
                    
                    // 添加磨损值和顺序
                    localMaterialsData[weaponName].push(wearValue);
                    localOrderTracker[weaponName].push(localCurrentOrders[weaponName]);
                    localCurrentOrders[weaponName]++;
                }
            }
        }
        // 格式3: 简化的未使用材料格式 (只有武器名称和磨损值)
        else if (line && !line.includes('原始磨损:') && !line.includes('归一化磨损:') && !line.includes('未使用材料') && 
                 i + 1 < lines.length && lines[i + 1].trim().includes('原始磨损:')) {
            const weaponName = line;
            let j = i + 1;
            
            // 初始化数据结构和计数器
            if (!localMaterialsData[weaponName]) {
                localMaterialsData[weaponName] = [];
                localOrderTracker[weaponName] = [];
                if (!localCurrentOrders[weaponName]) {
                    localCurrentOrders[weaponName] = 1;
                }
            }
            
            // 收集该武器下的所有磨损值
            while (j < lines.length && lines[j].trim().includes('原始磨损:')) {
                const wearLine = lines[j].trim();
                const wearMatch = wearLine.match(/原始磨损:\s*([0-9.]+)/);
                if (wearMatch) {
                    const wearValue = parseFloat(wearMatch[1]);
                    localMaterialsData[weaponName].push(wearValue);
                    localOrderTracker[weaponName].push(localCurrentOrders[weaponName]);
                    localCurrentOrders[weaponName]++;
                }
                j++;
            }
            
            i = j - 1; // 跳过已处理的行
        }
        
        i++;
    }
    
    return { 
        materials: localMaterialsData, 
        orders: localOrderTracker, 
        currentOrders: localCurrentOrders 
    };
}

// 处理数据 - 合并了添加数据和更新显示的功能
function processData() {
    const input = document.getElementById('inventoryInput').value;
    
    // 如果有输入数据，则解析并添加
    if (input.trim()) {
        const result = parseInventoryData(input);
        
        // 合并到全局数据
        for (const [materialName, wears] of Object.entries(result.materials)) {
            if (!materialsData[materialName]) {
                materialsData[materialName] = [];
                materialOrderTracker[materialName] = [];
            }
            materialsData[materialName].push(...wears);
            materialOrderTracker[materialName].push(...result.orders[materialName]);
        }
        
        // 更新每种材料的计数器
        for (const [materialName, currentOrder] of Object.entries(result.currentOrders)) {
            materialCurrentOrders[materialName] = currentOrder;
        }
        
        showStatus(`成功处理数据！当前材料总数: ${getTotalMaterials()}`, 'success');
        
        // 清空输入框
        document.getElementById('inventoryInput').value = '';
    } else {
        // 如果没有输入数据，只是更新显示
        if (getTotalMaterials() === 0) {
            showStatus('没有可处理的数据', 'error');
            return;
        }
        showStatus('数据已更新显示', 'info');
    }
    
    // 更新显示和生成输入框
    updateProcessedDataDisplay();
    generateRangeInputs();
}

// 清空数据
function clearData() {
    materialsData = {};
    materialOrderTracker = {};
    materialCurrentOrders = {};
    lastOptimizationResult = null;
    magicMaterialSearchResult = null;
    document.getElementById('inventoryInput').value = '';
    document.getElementById('processedData').textContent = 'materials_data = {}';
    document.getElementById('rangeInputs').innerHTML = '';
    document.getElementById('resultsContent').innerHTML = '';
    showStatus('数据已清空', 'info');
}

// 获取材料总数
function getTotalMaterials() {
    return Object.values(materialsData).reduce((total, wears) => total + wears.length, 0);
}

// 更新处理后的数据显示 - 现在包含顺序信息
function updateProcessedDataDisplay() {
    let output = 'materials_data = {\n';
    
    for (const [materialName, wearValues] of Object.entries(materialsData)) {
        output += `    "${materialName}": [\n`;
        
        for (let i = 0; i < wearValues.length; i++) {
            const wearValue = wearValues[i];
            const order = materialOrderTracker[materialName][i];
            output += `        ${wearValue},  // 原始位置: ${order}\n`;
        }
        
        output += '    ],\n';
    }
    
    output += '}';
    document.getElementById('processedData').textContent = output;
}

// 生成磨损范围输入
function generateRangeInputs() {
    const rangeInputs = document.getElementById('rangeInputs');
    rangeInputs.innerHTML = '';
    
    for (const materialName of Object.keys(materialsData)) {
        const rangeDiv = document.createElement('div');
        rangeDiv.className = 'range-input';
        
        // 创建安全的ID（替换空格为下划线）
        const safeId = materialName.replace(/\s+/g, '_');
        
        rangeDiv.innerHTML = `
            <label>${materialName} (${materialsData[materialName].length}个材料)</label>
            <div class="input-group">
                <div>
                    <label for="min_${safeId}">最小磨损:</label>
                    <input type="number" id="min_${safeId}" step="0.01" min="0" max="1" value="0">
                </div>
                <div>
                    <label for="max_${safeId}">最大磨损:</label>
                    <input type="number" id="max_${safeId}" step="0.01" min="0" max="1" value="1">
                </div>
            </div>
        `;
        
        rangeInputs.appendChild(rangeDiv);
    }
}

// 显示状态消息
function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
}

// 优化分配
function optimizeAllocation() {
    if (getTotalMaterials() === 0) {
        showStatus('没有可优化的数据', 'error');
        return;
    }
    
    // 获取磨损范围配置
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
}

// 重置优化
function resetOptimization() {
    document.getElementById('resultsContent').innerHTML = '';
    showStatus('优化结果已重置', 'info');
}

// 优化算法核心函数 - 改进版本：从高磨损开始，两阶段优化
function optimizeMaterialAllocation(materialsData, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed) {
    // 计算目标平均变形磨损
    const targetAvgTransformedWear = (targetMaxWear - targetMinWear) / (targetMaxWearFixed - targetMinWear);
    const targetTotalTransformedWear = targetAvgTransformedWear * 5;
    
    console.log(`目标磨损: ≤${targetMaxWear}`);
    console.log(`目标平均变形磨损: ${targetAvgTransformedWear.toFixed(6)}`);
    console.log(`目标总变形磨损: ${targetTotalTransformedWear.toFixed(6)}`);
    
    // 计算每个材料的归一化变形磨损
    const transformedMaterials = [];
    
    for (const [materialName, wears] of Object.entries(materialsData)) {
        const [minWear, maxWear] = materialRanges[materialName];
        const wearRange = maxWear - minWear;
        
        console.log(`${materialName}: 磨损范围 [${minWear}, ${maxWear}], 范围大小: ${wearRange}`);
        
        for (let i = 0; i < wears.length; i++) {
            const wear = wears[i];
            const originalOrder = materialOrderTracker[materialName][i];
            
            // 使用归一化公式: 变形磨损 = (材料磨损 - 材料最低磨损) / (材料最高磨损 - 材料最低磨损)
            const normalizedWear = (wear - minWear) / wearRange;
            
            const materialId = `${materialName}_${i}`;
            transformedMaterials.push({
                id: materialId,
                name: materialName,
                original_wear: wear,
                transformed_wear: normalizedWear,
                min_wear: minWear,
                max_wear: maxWear,
                wear_range: wearRange,
                original_order: originalOrder  // 保存原始位置
            });
        }
    }
    
    // 按变形磨损从高到低排序（优先使用高磨损材料）
    transformedMaterials.sort((a, b) => b.transformed_wear - a.transformed_wear);
    
    console.log(`总材料数量: ${transformedMaterials.length}`);
    console.log("归一化变形磨损统计 (从高到低排序):");
    console.log(`  最大值: ${Math.max(...transformedMaterials.map(m => m.transformed_wear)).toFixed(6)}`);
    console.log(`  最小值: ${Math.min(...transformedMaterials.map(m => m.transformed_wear)).toFixed(6)}`);
    console.log(`  平均值: ${(transformedMaterials.reduce((sum, m) => sum + m.transformed_wear, 0) / transformedMaterials.length).toFixed(6)}`);
    
    // 第一阶段：从高磨损材料开始，寻找最接近目标的组合
    const groups = [];
    let availableMaterials = [...transformedMaterials];
    
    console.log("=== 第一阶段：高磨损材料优化 ===");
    
    while (availableMaterials.length >= 5) {
        let bestCombination = null;
        let bestDiff = Infinity;
        let bestWearUtilization = 0;
        
        // 从可用材料的开始位置（高磨损区域）搜索
        for (let i = 0; i <= Math.min(20, availableMaterials.length - 5); i++) {
            const combination = availableMaterials.slice(i, i + 5);
            const totalWear = combination.reduce((sum, m) => sum + m.transformed_wear, 0);
            const diff = Math.abs(totalWear - targetTotalTransformedWear);
            
            // 计算磨损利用率（越接近目标，利用率越高）
            const wearUtilization = 1 - (diff / targetTotalTransformedWear);
            
            // 检查是否满足磨损限制
            const avgTransformed = totalWear / 5;
            const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
            
            if (actualWear <= targetMaxWear) {
                // 优先选择更接近目标且利用率更高的组合
                if (diff < bestDiff || (diff === bestDiff && wearUtilization > bestWearUtilization)) {
                    bestCombination = combination;
                    bestDiff = diff;
                    bestWearUtilization = wearUtilization;
                }
            }
        }
        
        // 如果找不到合适的组合，尝试扩展搜索范围
        if (bestCombination === null && availableMaterials.length > 20) {
            console.log("扩展搜索范围...");
            for (let i = 0; i <= availableMaterials.length - 5; i++) {
                const combination = availableMaterials.slice(i, i + 5);
                const totalWear = combination.reduce((sum, m) => sum + m.transformed_wear, 0);
                const diff = Math.abs(totalWear - targetTotalTransformedWear);
                
                const wearUtilization = 1 - (diff / targetTotalTransformedWear);
                const avgTransformed = totalWear / 5;
                const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
                
                if (actualWear <= targetMaxWear) {
                    if (diff < bestDiff || (diff === bestDiff && wearUtilization > bestWearUtilization)) {
                        bestCombination = combination;
                        bestDiff = diff;
                        bestWearUtilization = wearUtilization;
                    }
                }
            }
        }
        
        // 如果还是找不到，尝试允许轻微超出目标（但仍在合理范围内）
        if (bestCombination === null) {
            const tolerance = targetTotalTransformedWear * 0.1; // 允许10%的误差
            for (let i = 0; i <= availableMaterials.length - 5; i++) {
                const combination = availableMaterials.slice(i, i + 5);
                const totalWear = combination.reduce((sum, m) => sum + m.transformed_wear, 0);
                const diff = Math.abs(totalWear - targetTotalTransformedWear);
                
                if (diff <= tolerance) {
                    const wearUtilization = 1 - (diff / targetTotalTransformedWear);
                    if (diff < bestDiff || (diff === bestDiff && wearUtilization > bestWearUtilization)) {
                        bestCombination = combination;
                        bestDiff = diff;
                        bestWearUtilization = wearUtilization;
                    }
                }
            }
        }
        
        // 如果仍然找不到，使用最小磨损组合作为最后手段
        if (bestCombination === null) {
            bestCombination = availableMaterials.slice(-5); // 取最低的5个
            const totalWear = bestCombination.reduce((sum, m) => sum + m.transformed_wear, 0);
            const avgTransformed = totalWear / 5;
            const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
            
            if (actualWear > targetMaxWear) {
                console.log("无法找到满足条件的组合，停止搜索");
                break;
            }
            
            bestDiff = Math.abs(totalWear - targetTotalTransformedWear);
            bestWearUtilization = 1 - (bestDiff / targetTotalTransformedWear);
        }
        
        const totalWear = bestCombination.reduce((sum, m) => sum + m.transformed_wear, 0);
        const avgTransformed = totalWear / 5;
        const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
        
        groups.push({
            materials: [...bestCombination],
            total_transformed_wear: totalWear,
            actual_wear: actualWear,
            wear_diff: Math.abs(actualWear - targetMaxWear),
            wear_utilization: bestWearUtilization,
            efficiency: (totalWear / targetTotalTransformedWear) * 100
        });
        
        console.log(`组 ${groups.length}: 总归一化磨损=${totalWear.toFixed(6)}, 实际磨损=${actualWear.toFixed(6)}, 利用率=${(bestWearUtilization * 100).toFixed(1)}%`);
        
        // 从可用材料中移除已使用的材料
        for (const material of bestCombination) {
            const index = availableMaterials.findIndex(m => m.id === material.id);
            if (index !== -1) {
                availableMaterials.splice(index, 1);
            }
        }
        
        // 重新按磨损从高到低排序剩余材料
        availableMaterials.sort((a, b) => b.transformed_wear - a.transformed_wear);
    }
    
    // 第二阶段：对剩余的低磨损材料进行精细组合
    console.log("=== 第二阶段：低磨损材料精细优化 ===");
    
    if (availableMaterials.length >= 5) {
        // 对剩余材料按磨损从低到高排序，尝试不同的组合策略
        availableMaterials.sort((a, b) => a.transformed_wear - b.transformed_wear);
        
        const remainingGroups = [];
        let phase2Materials = [...availableMaterials];
        
        while (phase2Materials.length >= 5) {
            let bestCombination = null;
            let bestDiff = Infinity;
            
            // 尝试多种组合策略
            for (let strategy = 0; strategy < 3; strategy++) {
                let combination;
                
                switch (strategy) {
                    case 0: // 取最低的5个
                        combination = phase2Materials.slice(0, 5);
                        break;
                    case 1: // 取中间的5个
                        const mid = Math.floor(phase2Materials.length / 2) - 2;
                        combination = phase2Materials.slice(mid, mid + 5);
                        break;
                    case 2: // 取最高的5个（在剩余材料中）
                        combination = phase2Materials.slice(-5);
                        break;
                }
                
                const totalWear = combination.reduce((sum, m) => sum + m.transformed_wear, 0);
                const diff = Math.abs(totalWear - targetTotalTransformedWear);
                const avgTransformed = totalWear / 5;
                const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
                
                if (actualWear <= targetMaxWear && diff < bestDiff) {
                    bestCombination = combination;
                    bestDiff = diff;
                }
            }
            
            if (bestCombination) {
                const totalWear = bestCombination.reduce((sum, m) => sum + m.transformed_wear, 0);
                const avgTransformed = totalWear / 5;
                const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
                const wearUtilization = 1 - (bestDiff / targetTotalTransformedWear);
                
                remainingGroups.push({
                    materials: [...bestCombination],
                    total_transformed_wear: totalWear,
                    actual_wear: actualWear,
                    wear_diff: Math.abs(actualWear - targetMaxWear),
                    wear_utilization: wearUtilization,
                    efficiency: (totalWear / targetTotalTransformedWear) * 100,
                    phase: 2
                });
                
                console.log(`第二阶段组 ${remainingGroups.length}: 总归一化磨损=${totalWear.toFixed(6)}, 实际磨损=${actualWear.toFixed(6)}`);
                
                // 移除已使用的材料
                for (const material of bestCombination) {
                    const index = phase2Materials.findIndex(m => m.id === material.id);
                    if (index !== -1) {
                        phase2Materials.splice(index, 1);
                    }
                }
            } else {
                break;
            }
        }
        
        // 将第二阶段找到的组合加入到总结果中
        groups.push(...remainingGroups);
        availableMaterials = phase2Materials;
    }
    
    const unusedMaterials = availableMaterials;
    
    // 统计结果
    console.log(`合成结果:`);
    console.log(`可合成组数: ${groups.length}`);
    console.log(`使用材料数: ${groups.length * 5}`);
    console.log(`剩余材料数: ${unusedMaterials.length}`);
    
    let totalEfficiency = 0;
    let totalUtilization = 0;
    if (groups.length > 0) {
        totalEfficiency = groups.reduce((sum, group) => sum + group.efficiency, 0) / groups.length;
        totalUtilization = groups.reduce((sum, group) => sum + group.wear_utilization, 0) / groups.length;
        console.log(`平均效率: ${totalEfficiency.toFixed(1)}%`);
        console.log(`平均利用率: ${(totalUtilization * 100).toFixed(1)}%`);
    }
    
    // 构建完整结果并保存
    const fullResult = {
        groups: groups,
        unused_materials: unusedMaterials,
        total_groups: groups.length,
        total_used: groups.length * 5,
        total_unused: unusedMaterials.length,
        target_total_transformed_wear: targetTotalTransformedWear,
        avg_efficiency: totalEfficiency,
        avg_utilization: totalUtilization,
        // 添加按类型组织的未使用材料
        unused_by_type: {}
    };
    
    // 按类型组织未使用材料
    for (const material of unusedMaterials) {
        if (!fullResult.unused_by_type[material.name]) {
            fullResult.unused_by_type[material.name] = [];
        }
        fullResult.unused_by_type[material.name].push({
            original_wear: material.original_wear,
            transformed_wear: material.transformed_wear,
            original_order: material.original_order
        });
    }
    
    // 保存到全局变量
    lastOptimizationResult = fullResult;
    
    return fullResult;
}

// 寻找最优魔法材料函数
function findMagicMaterial() {
    if (getTotalMaterials() === 0) {
        showStatus('没有数据可进行魔法材料搜索', 'error');
        return;
    }
    
    showStatus('正在搜索最优魔法材料...', 'info');
    
    // 获取当前配置
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
    
    // 先计算基准组数（不添加魔法材料）
    const baselineResult = optimizeMaterialAllocation(materialsData, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed);
    const baselineGroups = baselineResult.total_groups;
    
    console.log(`基准组数: ${baselineGroups}`);
    
    // 搜索策略：从低到高扫描，找到最佳点
    let bestTransformedWear = 0;
    let bestGroups = baselineGroups;
    let bestImprovement = 0;
    let candidatePoints = [];
    
    // 第一阶段：粗粒度扫描 (0.0001 到 1.0，步长 0.01)
    for (let transformedWear = 0.0001; transformedWear <= 1.0; transformedWear += 0.01) {
        const testGroups = testMagicMaterial(transformedWear, materialsData, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed);
        const improvement = testGroups - baselineGroups;
        
        if (improvement > 0) {
            candidatePoints.push({
                transformedWear: transformedWear,
                groups: testGroups,
                improvement: improvement
            });
            
            if (improvement > bestImprovement) {
                bestImprovement = improvement;
                bestGroups = testGroups;
                bestTransformedWear = transformedWear;
            }
        }
        
        console.log(`变形磨损 ${transformedWear.toFixed(4)}: ${testGroups} 组 (改善: +${improvement})`);
    }
    
    // 如果没有找到改善的点，尝试更细的搜索
    if (candidatePoints.length === 0) {
        console.log("粗粒度搜索无改善，进行细粒度搜索...");
        for (let transformedWear = 0.0001; transformedWear <= 0.1; transformedWear += 0.001) {
            const testGroups = testMagicMaterial(transformedWear, materialsData, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed);
            const improvement = testGroups - baselineGroups;
            
            if (improvement > 0) {
                candidatePoints.push({
                    transformedWear: transformedWear,
                    groups: testGroups,
                    improvement: improvement
                });
                
                if (improvement > bestImprovement) {
                    bestImprovement = improvement;
                    bestGroups = testGroups;
                    bestTransformedWear = transformedWear;
                }
            }
        }
    }
    
    // 第二阶段：在候选点附近进行精细搜索
    if (candidatePoints.length > 0) {
        console.log("进行精细搜索优化...");
        
        // 找到所有达到最佳改善的点
        const bestCandidates = candidatePoints.filter(p => p.improvement === bestImprovement);
        
        // 在这些点附近进行更精细的搜索
        for (const candidate of bestCandidates) {
            const center = candidate.transformedWear;
            const searchRange = 0.01; // 搜索范围
            
            for (let offset = -searchRange; offset <= searchRange; offset += 0.0005) {
                const testWear = center + offset;
                if (testWear >= 0 && testWear <= 1) {
                    const testGroups = testMagicMaterial(testWear, materialsData, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed);
                    
                    if (testGroups > bestGroups || (testGroups === bestGroups && testWear < bestTransformedWear)) {
                        bestGroups = testGroups;
                        bestTransformedWear = testWear;
                        bestImprovement = bestGroups - baselineGroups;
                    }
                }
            }
        }
    }
    
    // 保存结果
    magicMaterialSearchResult = {
        baselineGroups: baselineGroups,
        bestTransformedWear: bestTransformedWear,
        bestGroups: bestGroups,
        improvement: bestImprovement,
        candidatePoints: candidatePoints
    };
    
    // 显示结果
    displayMagicMaterialResult();
}

// 测试特定变形磨损值的魔法材料
function testMagicMaterial(transformedWear, baseMaterials, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed) {
    // 复制基础材料数据
    const testMaterials = JSON.parse(JSON.stringify(baseMaterials));
    
    // 选择一种材料类型来添加魔法材料（选择材料数量最多的类型）
    let targetMaterial = Object.keys(testMaterials)[0];
    let maxCount = 0;
    
    for (const [materialName, wears] of Object.entries(testMaterials)) {
        if (wears.length > maxCount) {
            maxCount = wears.length;
            targetMaterial = materialName;
        }
    }
    
    // 添加魔法材料
    testMaterials[targetMaterial].push(0); // 添加一个占位值，实际磨损值会在优化过程中通过变形磨损计算
    
    // 运行优化
    const result = optimizeMaterialAllocation(testMaterials, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed);
    
    return result.total_groups;
}

// 显示魔法材料搜索结果
function displayMagicMaterialResult() {
    const result = magicMaterialSearchResult;
    const resultsContent = document.getElementById('resultsContent');
    
    let html = resultsContent.innerHTML; // 保留现有内容
    
    html += `<div class="group-result" style="border-left: 4px solid #9b59b6;">
        <div class="group-header" style="color: #9b59b6;">🎯 魔法材料搜索结果</div>
        
        <div><strong>基准情况:</strong> ${result.baselineGroups} 个合成组</div>`;
    
    if (result.improvement > 0) {
        html += `
        <div class="suggestion" style="background: #f3e8fd; border-left-color: #9b59b6;">
            <strong>🎉 找到魔法材料!</strong><br>
            <div>最优变形磨损: <span style="color: #9b59b6; font-weight: bold;">${result.bestTransformedWear.toFixed(6)}</span></div>
            <div>预期合成组数: <span style="color: #9b59b6; font-weight: bold;">${result.bestGroups}</span> 组</div>
            <div>改善效果: <span style="color: #27ae60; font-weight: bold;">+${result.improvement}</span> 组</div>
            <div style="margin-top: 10px;">
                <strong>如何获得这个魔法材料:</strong><br>
                寻找原始磨损约为 <span style="color: #9b59b6; font-weight: bold;">${calculateOriginalWearFromTransformed(result.bestTransformedWear).toFixed(6)}</span> 的材料
                (基于默认材料范围计算)
            </div>
        </div>`;
        
        // 显示候选点信息
        if (result.candidatePoints.length > 0) {
            html += `<div><strong>其他有效候选点:</strong></div>`;
            const uniqueImprovements = [...new Set(result.candidatePoints.map(p => p.improvement))].sort((a, b) => b - a);
            
            for (const improvement of uniqueImprovements) {
                if (improvement > 0) {
                    const points = result.candidatePoints.filter(p => p.improvement === improvement);
                    const wearValues = points.map(p => p.transformedWear.toFixed(4));
                    html += `<div>改善 +${improvement} 组: 变形磨损范围 [${Math.min(...wearValues)}, ${Math.max(...wearValues)}]</div>`;
                }
            }
        }
    } else {
        html += `
        <div class="status info">
            <strong>未找到能改善合成组数的魔法材料</strong><br>
            当前材料配置已经接近最优，或者需要更多不同类型的材料来产生改善效果。
        </div>`;
    }
    
    html += `</div>`;
    
    resultsContent.innerHTML = html;
    showStatus(`魔法材料搜索完成! ${result.improvement > 0 ? `找到改善 +${result.improvement} 组的最佳材料` : '未找到改善材料'}`, 
               result.improvement > 0 ? 'success' : 'info');
}

// 从变形磨损计算原始磨损（基于第一个材料的范围）
function calculateOriginalWearFromTransformed(transformedWear) {
    const materialNames = Object.keys(materialsData);
    if (materialNames.length === 0) return transformedWear;
    
    const firstMaterial = materialNames[0];
    const safeId = firstMaterial.replace(/\s+/g, '_');
    
    try {
        const minWear = parseFloat(document.getElementById(`min_${safeId}`).value) || 0;
        const maxWear = parseFloat(document.getElementById(`max_${safeId}`).value) || 1;
        const wearRange = maxWear - minWear;
        
        return transformedWear * wearRange + minWear;
    } catch (e) {
        return transformedWear; // 回退到直接使用变形磨损
    }
}

// 复制特定材料的未使用材料到剪贴板 - 基于优化结果
function copyUnusedMaterials(materialName) {
    if (!lastOptimizationResult || !lastOptimizationResult.unused_by_type[materialName]) {
        showStatus(`没有找到${materialName}的未使用材料`, 'error');
        return;
    }
    
    const materials = lastOptimizationResult.unused_by_type[materialName];
    let text = `${materialName}\n`;
    
    materials.forEach(material => {
        text += `原始磨损: ${material.original_wear.toFixed(6)}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        showStatus(`已复制${materialName}的未使用材料到剪贴板 (${materials.length}个)`, 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showStatus('复制失败，请手动复制', 'error');
    });
}

// 复制所有未使用材料到剪贴板 - 基于优化结果
function copyAllUnusedMaterials() {
    if (!lastOptimizationResult || Object.keys(lastOptimizationResult.unused_by_type).length === 0) {
        showStatus('没有找到未使用材料', 'error');
        return;
    }
    
    let text = '';
    let totalCount = 0;
    
    for (const [materialName, materials] of Object.entries(lastOptimizationResult.unused_by_type)) {
        text += `${materialName}\n`;
        materials.forEach(material => {
            text += `原始磨损: ${material.original_wear.toFixed(6)}\n`;
            totalCount++;
        });
        text += '\n';
    }
    
    navigator.clipboard.writeText(text.trim()).then(() => {
        showStatus(`已复制所有未使用材料到剪贴板 (${totalCount}个材料)`, 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showStatus('复制失败，请手动复制', 'error');
    });
}

// 更新结果显示函数，包含效率信息
function displayOptimizationResults(result) {
    const resultsContent = document.getElementById('resultsContent');
    let html = '';
    
    html += `<div class="status success">
        <strong>优化完成！</strong><br>
        总材料数: ${result.total_used + result.total_unused}<br>
        成功合成组数: ${result.total_groups}<br>
        使用材料数: ${result.total_used}<br>
        剩余材料数: ${result.total_unused}<br>
        材料利用率: ${((result.total_used / (result.total_used + result.total_unused)) * 100).toFixed(1)}%<br>
        平均磨损利用率: ${(result.avg_utilization * 100).toFixed(1)}%
    </div>`;
    
    if (result.groups.length > 0) {
        html += '<h3>详细分组情况:</h3>';
        
        for (let i = 0; i < result.groups.length; i++) {
            const group = result.groups[i];
            const wearDiff = result.target_total_transformed_wear - group.total_transformed_wear;
            
            html += `<div class="group-result">
                <div class="group-header">
                    第 ${i + 1} 组
                </div>
                <div>实际产出磨损: <span style="color: #28a745; font-weight: bold;">${group.actual_wear.toFixed(6)}</span></div>
                <div>磨损利用率: ${(group.wear_utilization * 100).toFixed(1)}%</div>`;
            
            // 找到组内变形磨损最小的材料
            const minWearMaterial = group.materials.reduce((min, material) => 
                material.transformed_wear < min.transformed_wear ? material : min
            );
            
            const replacementTransformedWear = wearDiff + minWearMaterial.transformed_wear;
            
            // 为每种材料类型计算替换建议
            let replacementSuggestions = '';
            const materialTypes = [...new Set(group.materials.map(m => m.name))];
            
            for (const materialType of materialTypes) {
                const sampleMaterial = group.materials.find(m => m.name === materialType);
                if (sampleMaterial) {
                    // 将归一化磨损转换回原始磨损
                    const replacementOriginalWear = replacementTransformedWear * sampleMaterial.wear_range + sampleMaterial.min_wear;
                    replacementSuggestions += `<div>${materialType}: 需要磨损 <span style="color: #28a745; font-weight: bold;">${replacementOriginalWear.toFixed(6)}</span></div>`;
                }
            }
            
            html += `<div class="suggestion">
                <strong>替换建议:</strong> 将最小归一化磨损材料替换为归一化磨损 <span style="color: #28a745; font-weight: bold;">${replacementTransformedWear.toFixed(6)}</span> 的材料
                <div><strong>具体对应原始磨损:</strong></div>
                ${replacementSuggestions}
            </div>`;
            
            html += '<div><strong>组内材料 (包含原始位置):</strong></div>';
            for (const material of group.materials) {
                const isReplaceable = material.id === minWearMaterial.id;
                html += `<div class="material-item ${isReplaceable ? 'suggestion' : ''}">
                    ${material.name}: <span style="color: #28a745; font-weight: bold;">原始磨损 ${material.original_wear.toFixed(6)}</span>, <span style="color: #6c757d; opacity: 0.7;">归一化磨损 ${material.transformed_wear.toFixed(6)}, 原始位置: ${material.original_order}</span>
                    ${isReplaceable ? ' [可替换]' : ''}
                </div>`;
            }
            
            html += '</div>';
        }
    }
    
    if (result.unused_materials.length > 0) {
        html += '<h3>未使用材料 (可复制到输入框继续处理):</h3>';
        const unusedByType = {};
        
        for (const material of result.unused_materials) {
            if (!unusedByType[material.name]) {
                unusedByType[material.name] = [];
            }
            unusedByType[material.name].push({
                original_wear: material.original_wear,
                transformed_wear: material.transformed_wear,
                original_order: material.original_order
            });
        }
        
        // 为每种材料类型输出格式化的未使用材料
        for (const [materialName, materials] of Object.entries(unusedByType)) {
            materials.sort((a, b) => a.original_wear - b.original_wear);
            
            html += `<div class="group-result">
                <div class="group-header">${materialName}</div>`;
            
            for (const material of materials) {
                html += `<div class="material-item">
                    <span style="color: #28a745; font-weight: bold;">原始磨损: ${material.original_wear.toFixed(6)}</span>, <span style="color: #6c757d; opacity: 0.7;">归一化磨损: ${material.transformed_wear.toFixed(6)}, 原始位置: ${material.original_order}</span>
                </div>`;
            }
            
            // 添加复制按钮
            html += `<div class="suggestion">
                <button onclick="copyUnusedMaterials('${materialName}')" class="btn-secondary" style="margin-top: 10px;">复制${materialName}的未使用材料</button>
            </div>`;
            
            html += '</div>';
        }
        
        // 添加复制所有未使用材料的按钮
        html += `<div class="suggestion">
            <button onclick="copyAllUnusedMaterials()" class="btn-primary">复制所有未使用材料</button>
        </div>`;
    }
    
    // 添加归一化说明
    html += `<div class="status info">
        <strong>归一化说明:</strong><br>
        所有材料的磨损都通过公式 <code>归一化磨损 = (原始磨损 - 材料最低磨损) / (材料最高磨损 - 材料最低磨损)</code> 转换到0-1区间<br>
        产出磨损通过公式 <code>产出磨损 = (平均归一化磨损) × (合成后金饰品的最大磨损 - 目标最小磨损) + 目标最小磨损</code> 计算<br>
        <strong>优化策略:</strong> 优先使用高磨损材料，两阶段优化，最大化磨损利用率
    </div>`;
    
    resultsContent.innerHTML = html;
}

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    // 绑定按钮事件
    document.getElementById('addDataBtn').addEventListener('click', processData);
    document.getElementById('clearDataBtn').addEventListener('click', clearData);
    document.getElementById('optimizeBtn').addEventListener('click', optimizeAllocation);
    document.getElementById('resetBtn').addEventListener('click', resetOptimization);
    
    // 添加魔法材料按钮事件绑定
    document.getElementById('magicMaterialBtn').addEventListener('click', findMagicMaterial);
    
    showStatus('准备就绪，请粘贴库存数据开始', 'info');
});