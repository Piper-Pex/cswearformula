// 在全局变量中添加
let magicMaterialSearchResult = null;

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

// 在DOM加载完成后添加魔法材料搜索按钮
document.addEventListener('DOMContentLoaded', function() {
    // 原有的绑定...
    
    // 在优化按钮后面添加魔法材料搜索按钮
    const optimizeBtn = document.getElementById('optimizeBtn');
    const magicMaterialBtn = document.createElement('button');
    magicMaterialBtn.id = 'magicMaterialBtn';
    magicMaterialBtn.className = 'btn-primary';
    magicMaterialBtn.innerHTML = '🔮 寻找魔法材料';
    magicMaterialBtn.addEventListener('click', findMagicMaterial);
    
    optimizeBtn.parentNode.insertBefore(magicMaterialBtn, optimizeBtn.nextSibling);
});

// 在现有的 optimizeMaterialAllocation 函数开始处添加调试信息
// 修改函数开头部分：
function optimizeMaterialAllocation(materialsData, materialRanges, targetMaxWear, targetMinWear, targetMaxWearFixed) {
    // 计算目标平均变形磨损
    const targetAvgTransformedWear = (targetMaxWear - targetMinWear) / (targetMaxWearFixed - targetMinWear);
    const targetTotalTransformedWear = targetAvgTransformedWear * 5;
    
    console.log(`=== 优化开始 ===`);
    console.log(`目标磨损: ≤${targetMaxWear}`);
    console.log(`目标平均变形磨损: ${targetAvgTransformedWear.toFixed(6)}`);
    console.log(`目标总变形磨损: ${targetTotalTransformedWear.toFixed(6)}`);
    console.log(`材料总数: ${getTotalMaterialsFromData(materialsData)}`);
    
    // 原有的优化逻辑保持不变...
    // [这里保持原有的 optimizeMaterialAllocation 函数内容]
    
    // 添加辅助函数来从任意材料数据获取总数
    function getTotalMaterialsFromData(data) {
        return Object.values(data).reduce((total, wears) => total + wears.length, 0);
    }
}