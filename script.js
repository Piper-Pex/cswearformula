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
    
    return {
        groups: groups,
        unused_materials: unusedMaterials,
        total_groups: groups.length,
        total_used: groups.length * 5,
        total_unused: unusedMaterials.length,
        target_total_transformed_wear: targetTotalTransformedWear,
        avg_efficiency: totalEfficiency,
        avg_utilization: totalUtilization
    };
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
        平均磨损利用率: ${(result.avg_utilization * 100).toFixed(1)}%<br>
        平均组合效率: ${result.avg_efficiency.toFixed(1)}%
    </div>`;
    
    if (result.groups.length > 0) {
        html += '<h3>详细分组情况:</h3>';
        
        for (let i = 0; i < result.groups.length; i++) {
            const group = result.groups[i];
            const wearDiff = result.target_total_transformed_wear - group.total_transformed_wear;
            const phaseInfo = group.phase === 2 ? ' (第二阶段)' : ' (第一阶段)';
            
            html += `<div class="group-result">
                <div class="group-header">
                    第 ${i + 1} 组${phaseInfo}
                </div>
                <div>总归一化磨损: ${group.total_transformed_wear.toFixed(6)}</div>
                <div>实际产出磨损: ${group.actual_wear.toFixed(6)}</div>
                <div>与目标差值: ${wearDiff.toFixed(6)}</div>
                <div>磨损利用率: ${(group.wear_utilization * 100).toFixed(1)}%</div>
                <div>组合效率: ${group.efficiency.toFixed(1)}%</div>`;
            
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
                    replacementSuggestions += `<div>${materialType}: 需要磨损 ${replacementOriginalWear.toFixed(6)}</div>`;
                }
            }
            
            html += `<div class="suggestion">
                <strong>替换建议:</strong> 将最小归一化磨损材料替换为归一化磨损 ${replacementTransformedWear.toFixed(6)} 的材料
                <div><strong>具体对应原始磨损:</strong></div>
                ${replacementSuggestions}
            </div>`;
            
            html += '<div><strong>组内材料 (包含原始位置):</strong></div>';
            for (const material of group.materials) {
                const isReplaceable = material.id === minWearMaterial.id;
                html += `<div class="material-item ${isReplaceable ? 'suggestion' : ''}">
                    ${material.name}: 原始磨损 ${material.original_wear.toFixed(6)}, 归一化磨损 ${material.transformed_wear.toFixed(6)}, 原始位置: ${material.original_order}
                    ${isReplaceable ? ' [可替换]' : ''}
                </div>`;
            }
            
            html += '</div>';
        }
    }
    
    // 其余显示未使用材料和说明的代码保持不变...
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
                    原始磨损: ${material.original_wear.toFixed(6)}, 归一化磨损: ${material.transformed_wear.toFixed(6)}, 原始位置: ${material.original_order}
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
        产出磨损通过公式 <code>产出磨损 = (平均归一化磨损) × (目标最大磨损 - 目标最小磨损) + 目标最小磨损</code> 计算<br>
        <strong>优化策略:</strong> 优先使用高磨损材料，两阶段优化，最大化磨损利用率
    </div>`;
    
    resultsContent.innerHTML = html;
}