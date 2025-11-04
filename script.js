// 全局变量
let materialsData = {};
let materialOrderTracker = {};
let materialCurrentOrders = {}; // 改为每种材料独立的计数器
let lastOptimizationResult = null;
let magicMaterialSearchResult = null; // 添加魔法材料搜索结果
let isTenCombineMode = false; // 添加十合一模式标志

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
                    <input type="number" id="min_${safeId}" step="0.00000000000000001" min="0" max="1" value="0">
                </div>
                <div>
                    <label for="max_${safeId}">最大磨损:</label>
                    <input type="number" id="max_${safeId}" step="0.00000000000000001" min="0" max="1" value="1">
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

// 切换十合一模式
function toggleTenCombineMode() {
    isTenCombineMode = document.getElementById('tenCombineMode').checked;
    const modeText = isTenCombineMode ? "十合一" : "五合一";
    showStatus(`已切换到${modeText}炼金模式`, 'info');
    
    // 更新按钮文本
    const magicBtn = document.getElementById('magicMaterialBtn');
    if (isTenCombineMode) {
        magicBtn.textContent = '🔮 寻找十合一魔法材料';
    } else {
        magicBtn.textContent = '🔮 寻找五合一魔法材料';
    }
}

// 优化分配
function optimizeAllocation() {
    if (getTotalMaterials() === 0) {
        showStatus('没有可优化的数据', 'error');
        return;
    }
    
    // 获取当前模式
    const groupSize = isTenCombineMode ? 10 : 5;
    
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
    const result = optimizeMaterialAllocation(materialsData, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed, groupSize);
    
    // 显示结果
    displayOptimizationResults(result);
}

// 重置优化
function resetOptimization() {
    document.getElementById('resultsContent').innerHTML = '';
    showStatus('优化结果已重置', 'info');
}

// 修正替换建议计算函数
function calculateReplacementRanges(group, targetTotalTransformedWear, groupSize) {
    const currentTotal = group.total_transformed_wear;
    const neededIncrease = targetTotalTransformedWear - currentTotal;
    
    const replacements = [];
    
    // 找出组内归一化磨损最小的材料（需要被替换的那个）
    let minTransformedWear = Infinity;
    let materialToReplace = null;
    
    for (const material of group.materials) {
        if (material.transformed_wear < minTransformedWear) {
            minTransformedWear = material.transformed_wear;
            materialToReplace = material;
        }
    }
    
    if (materialToReplace) {
        // 计算需要的新材料归一化磨损
        // 新总磨损 = 当前总磨损 - 被替换材料磨损 + 新材料磨损
        // 目标总磨损 = 当前总磨损 - minTransformedWear + requiredWear
        // 所以：requiredWear = 目标总磨损 - (当前总磨损 - minTransformedWear)
        const requiredWear = targetTotalTransformedWear - (currentTotal - minTransformedWear);
        
        if (requiredWear >= 0 && requiredWear <= 1) {
            replacements.push({
                materialName: materialToReplace.name,
                replaceMaterial: materialToReplace,
                requiredTransformedWear: requiredWear,
                improvement: requiredWear - minTransformedWear
            });
        }
    }
    
    return replacements;
}

// 优化算法核心函数 - 改进版本：更全面地搜索接近目标磨损的组合
function optimizeMaterialAllocation(materialsData, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed, groupSize = 5) {
    // 计算目标平均变形磨损
    const targetAvgTransformedWear = (targetMaxWear - targetMinWear) / (targetMaxWearFixed - targetMinWear);
    const targetTotalTransformedWear = targetAvgTransformedWear * groupSize;
    
    console.log(`目标磨损: ≤${targetMaxWear}`);
    console.log(`目标平均变形磨损: ${targetAvgTransformedWear.toFixed(17)}`);
    console.log(`目标总变形磨损: ${targetTotalTransformedWear.toFixed(17)}`);
    console.log(`每组材料数量: ${groupSize}`);
    
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
    console.log(`  最大值: ${Math.max(...transformedMaterials.map(m => m.transformed_wear)).toFixed(17)}`);
    console.log(`  最小值: ${Math.min(...transformedMaterials.map(m => m.transformed_wear)).toFixed(17)}`);
    console.log(`  平均值: ${(transformedMaterials.reduce((sum, m) => sum + m.transformed_wear, 0) / transformedMaterials.length).toFixed(17)}`);
    
    // 改进的组合搜索策略
    const groups = [];
    let availableMaterials = [...transformedMaterials];
    
    console.log("=== 改进的组合搜索策略 ===");
    
    while (availableMaterials.length >= groupSize) {
        let bestCombination = null;
        let bestActualWear = 0; // 优先选择实际磨损更高的组合
        let bestTotalTransformed = 0;
        
        // 策略1: 优先搜索高磨损组合
        // 从高磨损区域开始，尝试找到最接近但不超过目标磨损的组合
        for (let startIdx = 0; startIdx <= Math.min(50, availableMaterials.length - groupSize); startIdx++) {
            // 尝试不同大小的搜索窗口
            for (let windowSize = groupSize; windowSize <= Math.min(20, availableMaterials.length - startIdx); windowSize++) {
                if (startIdx + groupSize > availableMaterials.length) continue;
                
                // 在窗口内搜索最佳组合
                for (let i = startIdx; i <= startIdx + windowSize - groupSize; i++) {
                    const combination = availableMaterials.slice(i, i + groupSize);
                    const totalWear = combination.reduce((sum, m) => sum + m.transformed_wear, 0);
                    const avgTransformed = totalWear / groupSize;
                    const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
                    
                    // 检查是否满足磨损限制且比当前最佳组合更好
                    if (actualWear <= targetMaxWear && actualWear > bestActualWear) {
                        bestCombination = combination;
                        bestActualWear = actualWear;
                        bestTotalTransformed = totalWear;
                    }
                }
            }
        }
        
        // 策略2: 如果策略1没找到足够好的组合，放宽搜索范围
        if (bestCombination === null || bestActualWear < targetMaxWear * 0.95) {
            console.log("策略1未找到理想组合，启用策略2：全局搜索");
            
            // 在整个可用材料范围内搜索
            for (let i = 0; i <= availableMaterials.length - groupSize; i++) {
                const combination = availableMaterials.slice(i, i + groupSize);
                const totalWear = combination.reduce((sum, m) => sum + m.transformed_wear, 0);
                const avgTransformed = totalWear / groupSize;
                const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
                
                if (actualWear <= targetMaxWear && actualWear > bestActualWear) {
                    bestCombination = combination;
                    bestActualWear = actualWear;
                    bestTotalTransformed = totalWear;
                }
            }
        }
        
        // 策略3: 如果还是找不到，尝试允许轻微超出目标（但仍在合理范围内）
        if (bestCombination === null) {
            console.log("策略2未找到合适组合，启用策略3：允许轻微超出");
            const tolerance = targetMaxWear * 0.01; // 允许1%的超出
            
            for (let i = 0; i <= availableMaterials.length - groupSize; i++) {
                const combination = availableMaterials.slice(i, i + groupSize);
                const totalWear = combination.reduce((sum, m) => sum + m.transformed_wear, 0);
                const avgTransformed = totalWear / groupSize;
                const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
                
                if (actualWear <= targetMaxWear + tolerance && actualWear > bestActualWear) {
                    bestCombination = combination;
                    bestActualWear = actualWear;
                    bestTotalTransformed = totalWear;
                }
            }
        }
        
        // 如果仍然找不到，使用最高磨损组合作为最后手段
        if (bestCombination === null) {
            console.log("使用最高磨损组合作为最后手段");
            bestCombination = availableMaterials.slice(0, groupSize); // 取最高的groupSize个
            const totalWear = bestCombination.reduce((sum, m) => sum + m.transformed_wear, 0);
            const avgTransformed = totalWear / groupSize;
            const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
            
            if (actualWear > targetMaxWear) {
                console.log("无法找到满足条件的组合，停止搜索");
                break;
            }
            
            bestActualWear = actualWear;
            bestTotalTransformed = totalWear;
        }
        
        // 计算磨损利用率和效率
        const wearDiff = Math.abs(bestActualWear - targetMaxWear);
        const wearUtilization = 1 - (wearDiff / targetMaxWear);
        const efficiency = (bestTotalTransformed / targetTotalTransformedWear) * 100;
        
        groups.push({
            materials: [...bestCombination],
            total_transformed_wear: bestTotalTransformed,
            actual_wear: bestActualWear,
            wear_diff: wearDiff,
            wear_utilization: wearUtilization,
            efficiency: efficiency
        });
        
        console.log(`组 ${groups.length}: 实际磨损=${bestActualWear.toFixed(17)}, 总归一化磨损=${bestTotalTransformed.toFixed(17)}, 利用率=${(wearUtilization * 100).toFixed(1)}%`);
        
        // 从可用材料中移除已使用的材料
        for (const material of bestCombination) {
            const index = availableMaterials.findIndex(m => m.id === material.id);
            if (index !== -1) {
                availableMaterials.splice(index, 1);
            }
        }
        
        // 重新按磨损从高到低排序剩余材料
        availableMaterials.sort((a, b) => b.transformed_wear - a.transformed_wear);
        
        // 如果剩余材料很少，提前停止
        if (availableMaterials.length < groupSize * 2) {
            console.log("剩余材料较少，提前停止搜索");
            break;
        }
    }
    
    // 第二阶段：对剩余的低磨损材料进行精细组合（如果还有足够材料）
    console.log("=== 第二阶段：剩余材料精细优化 ===");
    
    if (availableMaterials.length >= groupSize) {
        // 对剩余材料尝试不同的组合策略
        const remainingGroups = [];
        let phase2Materials = [...availableMaterials];
        
        // 按磨损从高到低排序
        phase2Materials.sort((a, b) => b.transformed_wear - a.transformed_wear);
        
        while (phase2Materials.length >= groupSize) {
            let bestCombination = null;
            let bestActualWear = 0;
            
            // 尝试多种组合策略
            for (let strategy = 0; strategy < 5; strategy++) {
                let combination;
                
                switch (strategy) {
                    case 0: // 取最高的groupSize个
                        combination = phase2Materials.slice(0, groupSize);
                        break;
                    case 1: // 取次高的groupSize个
                        combination = phase2Materials.slice(1, groupSize + 1);
                        break;
                    case 2: // 混合高低磨损
                        combination = [];
                        // 取几个高磨损，几个中磨损，几个低磨损
                        const highCount = Math.floor(groupSize * 0.4);
                        const midCount = Math.floor(groupSize * 0.3);
                        const lowCount = groupSize - highCount - midCount;
                        
                        for (let i = 0; i < highCount; i++) {
                            combination.push(phase2Materials[i]);
                        }
                        for (let i = 0; i < midCount; i++) {
                            combination.push(phase2Materials[Math.floor(phase2Materials.length / 2) + i]);
                        }
                        for (let i = 0; i < lowCount; i++) {
                            combination.push(phase2Materials[phase2Materials.length - 1 - i]);
                        }
                        break;
                    case 3: // 随机采样多个组合
                        for (let attempt = 0; attempt < 10; attempt++) {
                            const sampled = [];
                            const indices = new Set();
                            while (indices.size < groupSize) {
                                indices.add(Math.floor(Math.random() * phase2Materials.length));
                            }
                            for (const idx of indices) {
                                sampled.push(phase2Materials[idx]);
                            }
                            const totalWear = sampled.reduce((sum, m) => sum + m.transformed_wear, 0);
                            const avgTransformed = totalWear / groupSize;
                            const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
                            
                            if (actualWear <= targetMaxWear && actualWear > bestActualWear) {
                                bestCombination = sampled;
                                bestActualWear = actualWear;
                            }
                        }
                        break;
                    case 4: // 系统性地搜索所有可能组合（仅当材料较少时）
                        if (phase2Materials.length <= 15) {
                            // 生成所有可能的groupSize个材料组合
                            const allCombinations = generateCombinations(phase2Materials, groupSize);
                            for (const comb of allCombinations) {
                                const totalWear = comb.reduce((sum, m) => sum + m.transformed_wear, 0);
                                const avgTransformed = totalWear / groupSize;
                                const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
                                
                                if (actualWear <= targetMaxWear && actualWear > bestActualWear) {
                                    bestCombination = comb;
                                    bestActualWear = actualWear;
                                }
                            }
                        }
                        break;
                }
                
                if (strategy !== 3 && strategy !== 4) { // 策略3和4已经在内部处理
                    const totalWear = combination.reduce((sum, m) => sum + m.transformed_wear, 0);
                    const avgTransformed = totalWear / groupSize;
                    const actualWear = avgTransformed * (targetMaxWearFixed - targetMinWear) + targetMinWear;
                    
                    if (actualWear <= targetMaxWear && actualWear > bestActualWear) {
                        bestCombination = combination;
                        bestActualWear = actualWear;
                    }
                }
            }
            
            if (bestCombination) {
                const totalWear = bestCombination.reduce((sum, m) => sum + m.transformed_wear, 0);
                const wearDiff = Math.abs(bestActualWear - targetMaxWear);
                const wearUtilization = 1 - (wearDiff / targetMaxWear);
                const efficiency = (totalWear / targetTotalTransformedWear) * 100;
                
                remainingGroups.push({
                    materials: [...bestCombination],
                    total_transformed_wear: totalWear,
                    actual_wear: bestActualWear,
                    wear_diff: wearDiff,
                    wear_utilization: wearUtilization,
                    efficiency: efficiency,
                    phase: 2
                });
                
                console.log(`第二阶段组 ${remainingGroups.length}: 实际磨损=${bestActualWear.toFixed(17)}`);
                
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
    console.log(`使用材料数: ${groups.length * groupSize}`);
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
        total_used: groups.length * groupSize,
        total_unused: unusedMaterials.length,
        target_total_transformed_wear: targetTotalTransformedWear,
        avg_efficiency: totalEfficiency,
        avg_utilization: totalUtilization,
        group_size: groupSize, // 保存每组材料数量
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

// 辅助函数：生成所有可能的组合（用于小规模搜索）
function generateCombinations(arr, k) {
    const result = [];
    
    function backtrack(start, current) {
        if (current.length === k) {
            result.push([...current]);
            return;
        }
        
        for (let i = start; i < arr.length; i++) {
            current.push(arr[i]);
            backtrack(i + 1, current);
            current.pop();
        }
    }
    
    backtrack(0, []);
    return result;
}

// 测试特定变形磨损值的魔法材料
function testMagicMaterial(transformedWear, baseMaterials, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed, materialType = null) {
    // 复制基础材料数据
    const testMaterials = JSON.parse(JSON.stringify(baseMaterials));
    
    // 如果指定了材料类型，使用该类型；否则选择材料数量最多的类型
    let targetMaterial = materialType;
    if (!targetMaterial) {
        let maxCount = 0;
        for (const [materialName, wears] of Object.entries(testMaterials)) {
            if (wears.length > maxCount) {
                maxCount = wears.length;
                targetMaterial = materialName;
            }
        }
    }
    
    // 获取目标材料的磨损范围
    const [minWear, maxWear] = materialRanges[targetMaterial];
    const wearRange = maxWear - minWear;
    
    // 将变形磨损转换回原始磨损并添加真实的材料
    const originalWear = transformedWear * wearRange + minWear;
    testMaterials[targetMaterial].push(originalWear);
    
    // 运行优化
    const groupSize = isTenCombineMode ? 10 : 5;
    const result = optimizeMaterialAllocation(testMaterials, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed, groupSize);
    
    return result.total_groups;
}

// 寻找最优魔法材料函数 - 改进版本
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
    
    // 创建精度降低后的材料数据副本
    const reducedPrecisionMaterials = {};
    for (const [materialName, wearValues] of Object.entries(materialsData)) {
        reducedPrecisionMaterials[materialName] = wearValues.map(wear => {
            // 将精度降低到小数点后7位，并在第7位加1
            const truncated = Math.floor(wear * 1e7) / 1e7; // 保留7位小数
            const adjusted = truncated + 1e-7; // 第7位加1
            return Math.min(adjusted, 1.0); // 确保不超过1.0
        });
    }
    
    // 先计算基准组数（不添加魔法材料，使用降低精度后的数据）
    const groupSize = isTenCombineMode ? 10 : 5;
    const baselineResult = optimizeMaterialAllocation(reducedPrecisionMaterials, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed, groupSize);
    const baselineGroups = baselineResult.total_groups;
    
    console.log(`基准组数: ${baselineGroups}`);
    
    let bestTransformedWear = 0;
    let bestGroups = baselineGroups;
    let bestImprovement = 0;
    let candidatePoints = [];
    let bestMaterialType = null;
    
    // 第一阶段：基于替换建议进行针对性搜索
    console.log("=== 第一阶段：基于替换建议的针对性搜索 ===");
    
    if (lastOptimizationResult) {
        const replacementTargets = [];
        
        // 收集所有替换建议
        for (const group of lastOptimizationResult.groups) {
            const replacements = calculateReplacementRanges(group, lastOptimizationResult.target_total_transformed_wear, groupSize);
            for (const replacement of replacements) {
                if (replacement.improvement > 0) { // 只考虑能改善的组合
                    replacementTargets.push({
                        transformedWear: replacement.requiredTransformedWear,
                        materialType: replacement.materialName,
                        improvement: replacement.improvement
                    });
                }
            }
        }
        
        // 按改善程度排序
        replacementTargets.sort((a, b) => b.improvement - a.improvement);
        
        // 在最优替换建议附近进行搜索
        for (const target of replacementTargets.slice(0, 10)) { // 取前10个最优目标
            const center = target.transformedWear;
            const range = 0.02; // 搜索范围
            
            console.log(`在替换目标 ${center.toFixed(7)} 附近搜索 (材料: ${target.materialType})`);
            
            for (let offset = -range; offset <= range; offset += 0.0001) {
                const testWear = center + offset;
                if (testWear >= 0 && testWear <= 1) {
                    const testGroups = testMagicMaterial(testWear, reducedPrecisionMaterials, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed, target.materialType);
                    const improvement = testGroups - baselineGroups;
                    
                    candidatePoints.push({
                        transformedWear: testWear,
                        groups: testGroups,
                        improvement: improvement,
                        materialType: target.materialType
                    });
                    
                    if (improvement > bestImprovement || (improvement === bestImprovement && testWear > bestTransformedWear)) {
                        bestImprovement = improvement;
                        bestGroups = testGroups;
                        bestTransformedWear = testWear;
                        bestMaterialType = target.materialType;
                    }
                    
                    if (improvement >= 2) {
                        console.log(`找到显著改善: 变形磨损 ${testWear.toFixed(7)} -> ${testGroups} 组 (改善: +${improvement})`);
                    }
                }
            }
        }
    }
    
    // 第二阶段：全局搜索作为备选（如果第一阶段没有找到改善）
    if (bestImprovement === 0) {
        console.log("=== 第二阶段：全局搜索 ===");
        
        // 搜索低磨损区域
        for (let transformedWear = 0.0001; transformedWear <= 0.1; transformedWear += 0.001) {
            const testGroups = testMagicMaterial(transformedWear, reducedPrecisionMaterials, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed);
            const improvement = testGroups - baselineGroups;
            
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
        
        // 搜索中高磨损区域
        if (bestImprovement === 0) {
            for (let transformedWear = 0.1; transformedWear <= 1.0; transformedWear += 0.01) {
                const testGroups = testMagicMaterial(transformedWear, reducedPrecisionMaterials, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed);
                const improvement = testGroups - baselineGroups;
                
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
    
    // 第三阶段：在最佳点附近进行精细搜索
    if (bestImprovement > 0) {
        console.log("=== 第三阶段：精细搜索 ===");
        
        const searchCenter = bestTransformedWear;
        const fineRange = 0.001;
        const currentMaterialType = bestMaterialType;
        
        for (let offset = -fineRange; offset <= fineRange; offset += 0.00001) {
            const testWear = searchCenter + offset;
            if (testWear >= 0 && testWear <= 1) {
                const testGroups = testMagicMaterial(testWear, reducedPrecisionMaterials, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed, currentMaterialType);
                const improvement = testGroups - baselineGroups;
                
                if (testGroups > bestGroups || (testGroups === bestGroups && testWear > bestTransformedWear)) {
                    bestGroups = testGroups;
                    bestTransformedWear = testWear;
                    bestImprovement = improvement;
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
        candidatePoints: candidatePoints,
        bestMaterialType: bestMaterialType,
        usedReducedPrecision: true,
        groupSize: groupSize
    };
    
    // 显示结果
    displayMagicMaterialResult();
}

// 显示魔法材料搜索结果
function displayMagicMaterialResult() {
    const result = magicMaterialSearchResult;
    const resultsContent = document.getElementById('resultsContent');
    
    let html = resultsContent.innerHTML; // 保留现有内容
    
    const modeText = isTenCombineMode ? "十合一" : "五合一";
    
    html += `<div class="group-result" style="border-left: 4px solid #9b59b6;">
        <div class="group-header" style="color: #9b59b6;">🎯 ${modeText}魔法材料搜索结果</div>`;
    
    // 添加精度提示
    if (result.usedReducedPrecision) {
        html += `<div class="status info" style="margin-bottom: 10px;">
            <small>🔍 搜索时使用了降低精度模式（小数点后7位）以提高性能，最终结果可能需要在实际游戏中微调</small>
        </div>`;
    }
    
    html += `<div><strong>基准情况:</strong> ${result.baselineGroups} 个合成组</div>`;
    
    if (result.improvement > 0) {
        // 计算所有材料类型的原始磨损建议
        let originalWearSuggestions = '';
        for (const materialName of Object.keys(materialsData)) {
            const safeId = materialName.replace(/\s+/g, '_');
            const minWear = parseFloat(document.getElementById(`min_${safeId}`).value) || 0;
            const maxWear = parseFloat(document.getElementById(`max_${safeId}`).value) || 1;
            const wearRange = maxWear - minWear;
            const originalWear = result.bestTransformedWear * wearRange + minWear;
            
            originalWearSuggestions += `<div>${materialName}: <span style="color: #9b59b6; font-weight: bold;">${originalWear.toFixed(17)}</span></div>`;
        }
        
        html += `
        <div class="suggestion" style="background: #f3e8fd; border-left-color: #9b59b6;">
            <strong>🎉 找到魔法材料!</strong><br>
            <div>最优变形磨损: <span style="color: #9b59b6; font-weight: bold;">${result.bestTransformedWear.toFixed(17)}</span></div>
            <div>预期合成组数: <span style="color: #9b59b6; font-weight: bold;">${result.bestGroups}</span> 组</div>
            <div>改善效果: <span style="color: #27ae60; font-weight: bold;">+${result.improvement}</span> 组</div>`;
        
        if (result.bestMaterialType) {
            html += `<div>推荐材料类型: <span style="color: #9b59b6; font-weight: bold;">${result.bestMaterialType}</span></div>`;
        }
        
        html += `
            <div style="margin-top: 10px;">
                <strong>对应原始磨损:</strong><br>
                ${originalWearSuggestions}
            </div>
        </div>`;
        
        // 显示所有候选点信息
        if (result.candidatePoints.length > 0) {
            html += `<div><strong>搜索统计:</strong></div>`;
            const uniqueGroups = [...new Set(result.candidatePoints.map(p => p.groups))].sort((a, b) => b - a);
            
            for (const groupCount of uniqueGroups) {
                if (groupCount > result.baselineGroups) {
                    const points = result.candidatePoints.filter(p => p.groups === groupCount);
                    const wearValues = points.map(p => p.transformedWear);
                    const minWear = Math.min(...wearValues).toFixed(7);
                    const maxWear = Math.max(...wearValues).toFixed(7);
                    const improvement = groupCount - result.baselineGroups;
                    html += `<div>改善 +${improvement} 组: 变形磨损范围 [${minWear}, ${maxWear}] (${points.length}个测试点)</div>`;
                }
            }
        }
    } else {
        html += `
        <div class="status info">
            <strong>未找到能改善合成组数的魔法材料</strong><br>
            当前材料配置已经接近最优，添加单个材料无法产生改善效果。
        </div>`;
    }
    
    html += `</div>`;
    
    resultsContent.innerHTML = html;
    showStatus(`${modeText}魔法材料搜索完成! ${result.improvement > 0 ? `找到改善 +${result.improvement} 组的最佳材料` : '未找到改善材料'}`, 
               result.improvement > 0 ? 'success' : 'info');
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
        text += `原始磨损: ${material.original_wear.toFixed(17)}\n`;
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
            text += `原始磨损: ${material.original_wear.toFixed(17)}\n`;
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

// 更新结果显示函数，修正替换建议的显示
function displayOptimizationResults(result) {
    const resultsContent = document.getElementById('resultsContent');
    let html = '';
    
    const modeText = isTenCombineMode ? "十合一" : "五合一";
    const groupSize = result.group_size || (isTenCombineMode ? 10 : 5);
    
    html += `<div class="status success">
        <strong>${modeText}优化完成！</strong><br>
        总材料数: ${result.total_used + result.total_unused}<br>
        成功合成组数: ${result.total_groups}<br>
        每组材料数: ${groupSize}<br>
        使用材料数: ${result.total_used}<br>
        剩余材料数: ${result.total_unused}<br>
        材料利用率: ${((result.total_used / (result.total_used + result.total_unused)) * 100).toFixed(1)}%<br>
        平均磨损利用率: ${(result.avg_utilization * 100).toFixed(1)}%
    </div>`;
    
    if (result.groups.length > 0) {
        html += `<h3>详细分组情况 (${modeText}):</h3>`;
        
        // 获取目标磨损参数用于验证
        const targetMaxWear = parseFloat(document.getElementById('targetWear').value);
        const targetMinWear = parseFloat(document.getElementById('targetMinWear').value);
        const targetMaxWearFixed = parseFloat(document.getElementById('targetMaxWearFixed').value);
        
        for (let i = 0; i < result.groups.length; i++) {
            const group = result.groups[i];
            
            html += `<div class="group-result">
                <div class="group-header">
                    第 ${i + 1} 组 (${modeText})
                </div>
                <div>实际产出磨损: <span style="color: #28a745; font-weight: bold;">${group.actual_wear.toFixed(17)}</span></div>
                <div>目标最大磨损: <span style="color: #6c757d;">${targetMaxWear}</span></div>
                <div>磨损利用率: ${(group.wear_utilization * 100).toFixed(1)}%</div>`;
            
            // 计算替换建议
            const replacementTargets = calculateReplacementRanges(group, result.target_total_transformed_wear, groupSize);
            
            if (replacementTargets.length > 0) {
                const bestReplacement = replacementTargets[0];
                
                // 验证替换后的实际磨损
                const newTotalTransformedWear = group.total_transformed_wear - bestReplacement.replaceMaterial.transformed_wear + bestReplacement.requiredTransformedWear;
                const newAvgTransformedWear = newTotalTransformedWear / groupSize;
                const newActualWear = newAvgTransformedWear * (targetMaxWearFixed - targetMinWear) + targetMinWear;
                const isValid = newActualWear <= targetMaxWear;
                
                // 获取所有材料类型的磨损范围配置
                const materialRanges = {};
                for (const materialName of Object.keys(materialsData)) {
                    const safeId = materialName.replace(/\s+/g, '_');
                    const minWear = parseFloat(document.getElementById(`min_${safeId}`).value);
                    const maxWear = parseFloat(document.getElementById(`max_${safeId}`).value);
                    materialRanges[materialName] = [minWear, maxWear];
                }
                
                // 为每种材料类型计算对应的原始磨损
                let originalWearSuggestions = '';
                for (const [materialName, range] of Object.entries(materialRanges)) {
                    const [minWear, maxWear] = range;
                    const wearRange = maxWear - minWear;
                    const originalWear = bestReplacement.requiredTransformedWear * wearRange + minWear;
                    
                    // 检查计算出的原始磨损是否在合理范围内
                    const isWearValid = originalWear >= minWear && originalWear <= maxWear;
                    const displayClass = isWearValid ? 'valid-wear' : 'invalid-wear';
                    
                    originalWearSuggestions += `
                        <div class="${displayClass}">
                            ${materialName}: <span style="font-weight: bold;">${originalWear.toFixed(17)}</span>
                            ${!isWearValid ? ' <span style="color: #dc3545;">(超出材料磨损范围)</span>' : ''}
                        </div>`;
                }
                
                html += `<div class="suggestion ${isValid ? 'valid-suggestion' : 'invalid-suggestion'}">
                    <strong>替换建议:</strong> 将 ${bestReplacement.materialName} 的材料替换为归一化磨损 <span style="font-weight: bold;">${bestReplacement.requiredTransformedWear.toFixed(17)}</span> 的材料
                    <div style="margin-top: 8px;"><strong>替换后产出磨损:</strong> ${newActualWear.toFixed(17)} ${isValid ? '✅' : '❌'}</div>
                    ${!isValid ? `<div style="color: #dc3545;">警告: 替换后将超出目标磨损 ${targetMaxWear}</div>` : ''}
                    <div style="margin-top: 8px;"><strong>对应原始磨损 (所有材料类型):</strong></div>
                    ${originalWearSuggestions}
                    <div style="margin-top: 8px;"><small>改善程度: +${bestReplacement.improvement.toFixed(17)} 归一化磨损</small></div>
                </div>`;
            } else {
                html += `<div class="status info">
                    当前组合已接近最优，替换单个材料无法进一步改善
                </div>`;
            }
            
            html += `<div><strong>组内材料 (包含原始位置, 共${group.materials.length}个):</strong></div>`;
            
            // 找出组内归一化磨损最小的材料（需要被替换的那个）
            let minTransformedWear = Infinity;
            let materialToReplace = null;
            
            for (const material of group.materials) {
                if (material.transformed_wear < minTransformedWear) {
                    minTransformedWear = material.transformed_wear;
                    materialToReplace = material;
                }
            }
            
            // 显示所有材料，但只在需要替换的材料上标记
            for (const material of group.materials) {
                const isReplaceable = material === materialToReplace;
                html += `<div class="material-item ${isReplaceable ? 'replaceable' : ''}">
                    ${material.name}: <span style="color: #28a745; font-weight: bold;">原始磨损 ${material.original_wear.toFixed(17)}</span>, <span style="color: #6c757d; opacity: 0.7;">归一化磨损 ${material.transformed_wear.toFixed(17)}, 原始位置: ${material.original_order}</span>
                    ${isReplaceable ? ' [可替换]' : ''}
                </div>`;
            }
            
            html += '</div>';
        }
    }
    
    if (result.unused_materials.length > 0) {
        html += `<h3>未使用材料 (可复制到输入框继续处理):</h3>`;
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
                    <span style="color: #28a745; font-weight: bold;">原始磨损: ${material.original_wear.toFixed(17)}</span>, <span style="color: #6c757d; opacity: 0.7;">归一化磨损: ${material.transformed_wear.toFixed(17)}, 原始位置: ${material.original_order}</span>
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
        <strong>${modeText}归一化说明:</strong><br>
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
    
    // 绑定十合一模式切换事件
    document.getElementById('tenCombineMode').addEventListener('change', toggleTenCombineMode);
    
    showStatus('准备就绪，请粘贴库存数据开始', 'info');
});