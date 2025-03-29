// js/stock_detail.js

document.addEventListener('DOMContentLoaded', () => {
    const stockNameElement = document.getElementById('stock-name');
    const stockSymbolElement = document.getElementById('stock-symbol');
    const chartContainer = document.getElementById('kline-chart');
    const chartLoadingElement = document.getElementById('chart-loading');
    const aktoolsApiBaseUrl = 'http://127.0.0.1:8080'; // 确认 AKTools 地址

    // --- 1. 从 URL 获取股票代码 ---
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol');

    if (!symbol) {
        stockNameElement.textContent = '错误';
        stockSymbolElement.textContent = '未提供股票代码';
        chartLoadingElement.textContent = '无法加载数据：URL中缺少股票代码参数。';
        return; // 没有代码则停止执行
    }

    stockSymbolElement.textContent = symbol;
    // 可以在这里额外请求一次实时行情接口获取最新名称，或者直接显示代码
    // 为简化，先只显示代码，名称可以在获取历史数据后尝试从某处获得（如果API返回）
    stockNameElement.textContent = `股票 ${symbol}`; // 临时名称


    // --- 2. 获取历史 K 线数据 ---
    
async function fetchHistoricalData(stockSymbol, period = 'daily', adjust = 'qfq', startDate = null, endDate = null) { // 增加更多参数，startDate默认为null
    const historyApiUrl = `${aktoolsApiBaseUrl}/api/public/stock_zh_a_hist`;
    // --- 修改部分：动态构建参数 ---
    const params = new URLSearchParams({
        symbol: stockSymbol,
        period: period,
        adjust: adjust
    });
    // 只有当 startDate 和 endDate 有值时才添加到 URL 参数中
    if (startDate) {
        params.append('start_date', startDate);
    }
    if (!endDate) {
        // 如果没提供结束日期，默认为今天
        endDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    }
    params.append('end_date', endDate)

        const requestUrl = `${historyApiUrl}?${params.toString()}`;
        console.log(`Fetching historical data from: ${requestUrl}`);
        chartLoadingElement.textContent = '正在加载K线数据...';

        try {
            const response = await fetch(requestUrl);
            if (!response.ok) {
                const errorText = await response.text(); // Try to get error details
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const data = await response.json();
            console.log("Historical data received:", data);

            if (data && Array.isArray(data) && data.length > 0) {
                 // 如果API返回的数据里包含名称，可以在这里更新 H1
                 // if(data[0] && data[0]['名称']) { stockNameElement.textContent = data[0]['名称']; }
                 return data; // 返回获取到的数据
            } else {
                 chartLoadingElement.textContent = '未能加载历史数据或数据为空。';
                 console.warn("Received historical data is empty or not in expected format:", data);
                 return null;
            }

        } catch (error) {
            console.error("Error fetching historical data:", error);
            chartLoadingElement.textContent = `加载历史数据失败: ${error.message}`;
            return null;
        }
    }

    // --- 3 & 4. 处理数据并使用 ECharts 渲染图表 ---
    function renderKlineChart(rawData) {
        if (!rawData || rawData.length === 0) {
            chartLoadingElement.textContent = '没有足够的历史数据来绘制图表。';
            return;
        }
         // 隐藏加载提示
        chartLoadingElement.style.display = 'none';

        // 初始化 ECharts 实例
        const myChart = echarts.init(chartContainer);

        // 数据处理：将 AKShare 返回的格式转换为 ECharts 需要的格式
        // ECharts K线图需要: [['日期', '开盘', '收盘', '最低', '最高', '成交量'], ...]
        // 并且日期通常是 'YYYY-MM-DD' 格式
        const processedData = rawData.map(item => {
            // 确保使用正确的列名! 检查 AKTools API 的实际返回值
            return [
                item['日期'],       // 通常是 'YYYY-MM-DD' 或 'YYYYMMDD'，ECharts 能识别多种格式
                item['开盘'],
                item['收盘'],
                item['最低'],
                item['最高'],
                item['成交量']      // 成交量用于下方柱状图
            ];
        });

        // 提取日期作为 X 轴数据
        const dates = processedData.map(item => item[0]);
        // 提取 OHLC 数据
        const ohlcData = processedData.map(item => item.slice(1, 5)); // 提取 开, 收, 低, 高
        // 提取成交量数据
        const volumes = processedData.map((item, index) => [index, item[5], item[1] > item[2] ? -1 : 1]); // [index, volume, sign for color]


        // ECharts 配置项
        const option = {
            animation: false, // 关闭动画提高性能
            legend: {
                bottom: 10,
                left: 'center',
                data: ['日K', 'MA5', 'MA10', 'MA20'] // 图例
            },
            tooltip: { // 提示框
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                },
                 //borderWidth: 1,
                 //borderColor: '#ccc',
                 //padding: 10,
                 //textStyle: {
                 //    color: '#000'
                 //},
                 //position: function (pos, params, el, elRect, size) {
                 //  const obj = { top: 10 };
                 //  obj[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 30;
                 //  return obj;
                 //}
                 // 可根据需要自定义提示框样式和内容 formatter
                 formatter: function (params) {
                    const dataIndex = params[0].dataIndex;
                    const kData = ohlcData[dataIndex];
                    const date = dates[dataIndex];
                    let tooltipHtml = `${date}<br/>`;
                    tooltipHtml += `开盘: ${kData[0]}<br/>`;
                    tooltipHtml += `收盘: ${kData[1]}<br/>`;
                    tooltipHtml += `最低: ${kData[2]}<br/>`;
                    tooltipHtml += `最高: ${kData[3]}<br/>`;
                    // 添加均线等其他 series 的值
                    params.forEach(param => {
                        if (param.seriesType === 'line') {
                            tooltipHtml += `${param.seriesName}: ${param.value !== undefined ? param.value.toFixed(2) : '-'}<br/>`;
                        }
                    });
                     tooltipHtml += `成交量: ${volumes[dataIndex][1]}<br/>`;
                    return tooltipHtml;
                 }
            },
            axisPointer: { // 坐标轴指示器联动
                link: [{ xAxisIndex: 'all' }],
                label: {
                    backgroundColor: '#777'
                }
            },
            toolbox: { // 工具栏
                feature: {
                    dataZoom: { yAxisIndex: false }, // 区域缩放
                    brush: { type: ['lineX', 'clear'] }, // 选框工具
                    restore: {}, // 配置项还原
                    saveAsImage: {} // 保存为图片
                }
            },
            grid: [ // 上下两个图表区域
                { // K 线图区域
                    left: '10%',
                    right: '8%',
                    height: '50%' // 顶部 K 线占 50% 高度
                },
                { // 成交量图区域
                    left: '10%',
                    right: '8%',
                    top: '65%', // 从 65% 的位置开始
                    height: '16%' // 底部成交量占 16% 高度
                }
            ],
            xAxis: [ // X 轴配置 (共享)
                { // K线图的 X 轴
                    type: 'category',
                    data: dates,
                    scale: true,
                    boundaryGap: false,
                    axisLine: { onZero: false },
                    splitLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: false }, // 不显示 K 线图的 X 轴标签
                    min: 'dataMin',
                    max: 'dataMax',
                    axisPointer: { z: 100 }
                },
                { // 成交量图的 X 轴
                    type: 'category',
                    gridIndex: 1, // 关联到第二个 grid
                    data: dates,
                    scale: true,
                    boundaryGap: false,
                    axisLine: { onZero: false },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: { show: true }, // 显示成交量图的 X 轴标签
                    min: 'dataMin',
                    max: 'dataMax'
                }
            ],
            yAxis: [ // Y 轴配置
                { // K 线图的 Y 轴 (价格)
                    scale: true,
                    splitArea: { show: true }
                },
                { // 成交量图的 Y 轴
                    scale: true,
                    gridIndex: 1, // 关联到第二个 grid
                    splitNumber: 2,
                    axisLabel: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { show: false }
                }
            ],
            dataZoom: [ // 区域缩放配置
                { // 内置型，在 K 线图内部拖动
                    type: 'inside',
                    xAxisIndex: [0, 1], // 同时缩放 K 线和成交量的 X 轴
                    start: 80, // 默认显示最近 20% 的数据
                    end: 100
                },
                { // 滑块型，在图表下方显示
                    show: true,
                    xAxisIndex: [0, 1], // 同时控制 K 线和成交量的 X 轴
                    type: 'slider',
                    top: '85%', // 放在成交量图下方
                    start: 80,
                    end: 100
                }
            ],
            series: [ // 图表系列数据
                {
                    name: '日K',
                    type: 'candlestick',
                    data: ohlcData, // OHLC 数据
                    itemStyle: {
                        color: '#ec0000', // 阳线颜色
                        color0: '#00da3c', // 阴线颜色
                        borderColor: '#8A0000',
                        borderColor0: '#008F28'
                    }
                },
                // --- 添加均线 (MA) ---
                {
                    name: 'MA5',
                    type: 'line',
                    data: calculateMA(5, ohlcData), // 计算 5 日均线
                    smooth: true,
                    lineStyle: { opacity: 0.5 }
                },
                {
                    name: 'MA10',
                    type: 'line',
                    data: calculateMA(10, ohlcData), // 计算 10 日均线
                    smooth: true,
                    lineStyle: { opacity: 0.5 }
                },
                {
                    name: 'MA20',
                    type: 'line',
                    data: calculateMA(20, ohlcData), // 计算 20 日均线
                    smooth: true,
                    lineStyle: { opacity: 0.5 }
                },
                // --- 成交量柱状图 ---
                {
                    name: 'Volume',
                    type: 'bar',
                    xAxisIndex: 1, // 使用第二个 X 轴
                    yAxisIndex: 1, // 使用第二个 Y 轴
                    data: volumes, // 成交量数据 [index, volume, sign]
                    itemStyle: {
                        color: ({ data }) => (data[2] === 1 ? '#ec0000' : '#00da3c') // 根据涨跌决定颜色
                    }
                }
            ]
        };

        // --- Helper function to calculate Moving Average ---
        function calculateMA(dayCount, ohlcData) {
            var result = [];
            for (var i = 0, len = ohlcData.length; i < len; i++) {
                if (i < dayCount -1) { // 前面几天无法计算均线
                    result.push('-'); // ECharts 能识别 '-' 为空值
                    continue;
                }
                var sum = 0;
                for (var j = 0; j < dayCount; j++) {
                    sum += parseFloat(ohlcData[i - j][1]); // 计算收盘价 (index 1) 的均值
                }
                result.push(+(sum / dayCount).toFixed(2)); // 保留两位小数
            }
            return result;
        }


        // 使用刚指定的配置项和数据显示图表。
        myChart.setOption(option);

        // (可选) 监听窗口大小变化，自适应调整图表大小
        window.addEventListener('resize', () => {
            myChart.resize();
        });
    }

    // --- 执行数据获取和渲染 ---
    fetchHistoricalData(symbol).then(historicalData => {
        if (historicalData) {
            renderKlineChart(historicalData);
        }
        // 如果 historicalData 为 null，则错误信息已在 fetchHistoricalData 中显示
    });

});
