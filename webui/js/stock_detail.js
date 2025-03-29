// js/stock_detail.js

// 使 ECharts 实例全局可访问，以便进行更新（例如，时间范围更改）
let myChart = null;

document.addEventListener('DOMContentLoaded', async () => { // 使用 async 进行初始等待
    // --- 配置 ---
    const aktoolsApiBaseUrl = 'http://127.0.0.1:8080'; // *** 您的 AKTools 服务器地址 ***

    // --- 获取 DOM 元素 ---
    const stockNameElement = document.getElementById('stock-name');
    const stockSymbolElement = document.getElementById('stock-symbol');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    // K 线元素
    const chartContainer = document.getElementById('kline-chart');
    const chartLoadingElement = document.getElementById('chart-loading');
    const rangeSelector = document.getElementById('time-range-selector'); // 可选的时间范围按钮容器

    // 其他选项卡内容元素
    const companyInfoContent = document.getElementById('company-info-content');
    const fundflowContent = document.getElementById('fundflow-content');
    // const fundflowChartContainer = document.getElementById('fundflow-chart'); // 可选的资金流向图表
    const lhbContent = document.getElementById('lhb-content');
    const lhbTable = document.getElementById('lhb-table');
    const lhbTableBody = lhbTable ? lhbTable.querySelector('tbody') : null;
    const lhbTableHead = lhbTable ? lhbTable.querySelector('thead') : null;
    const shareholderContent = document.getElementById('shareholder-content');
    const shareholderTable = document.getElementById('shareholder-table');
    const shareholderTableBody = shareholderTable ? shareholderTable.querySelector('tbody') : null;
    const shareholderTableHead = shareholderTable ? shareholderTable.querySelector('thead') : null;
    const newsContent = document.getElementById('news-content');
    const newsList = document.getElementById('news-list');
    const quoteContent = document.getElementById('quote-content');

    // --- 从 URL 获取股票代码 ---
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol');

    if (!symbol) {
        stockNameElement.textContent = '错误';
        stockSymbolElement.textContent = '';
        document.querySelector('main').innerHTML = '<h2 style="color: red;">错误：URL中未提供股票代码 (symbol)。</h2><p>请确保链接包含 `?symbol=XXXXXX`</p>';
        return; // 停止执行
    }
    stockSymbolElement.textContent = symbol;
    stockNameElement.textContent = `股票 ${symbol}`; // 初始名称，将由 fetchCompanyInfo 更新


    // --- API 获取的辅助函数 ---
    async function fetchData(apiUrl, loadingElement, errorMsgPrefix) {
        if (loadingElement) loadingElement.textContent = '加载中...';
        if (loadingElement && loadingElement.style) loadingElement.style.display = 'block'; // 确保加载可见

        console.log(`Fetching: ${apiUrl}`); // 记录 API 调用以进行调试
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                let errorDetails = '';
                try {
                    errorDetails = await response.text(); // 尝试获取文本以获取更多信息
                } catch (e) {}
                 console.error(`HTTP error ${response.status} for ${apiUrl}: ${errorDetails}`);
                 throw new Error(`HTTP ${response.status}${errorDetails ? ': ' + errorDetails.substring(0,100) + '...' : ''}`); // 限制错误长度
            }
            const data = await response.json();
            console.log(`Data for ${apiUrl}:`, data); // 记录接收到的数据

            if (loadingElement && loadingElement.style) loadingElement.style.display = 'none'; // 成功后隐藏加载
            return data;

        } catch (error) {
            console.error(`${errorMsgPrefix} Error:`, error);
            if (loadingElement) loadingElement.textContent = `${errorMsgPrefix}失败: ${error.message}`;
            return null; // 指示失败
        }
    }

    // --- 选项卡切换逻辑 ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabType = button.dataset.tab;

            // 更新活动状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`tab-${tabType}`)?.classList.add('active');

            // 仅当内容仍然显示“加载中...”时才延迟加载数据
            switch (tabType) {
                case 'info':
                    if (companyInfoContent?.textContent.includes('加载中')) fetchCompanyInfo(symbol);
                    break;
                case 'fundflow':
                    if (fundflowContent?.textContent.includes('加载中')) fetchFundFlow(symbol);
                    break;
                case 'lhb':
                    if (lhbContent?.textContent.includes('加载中')) fetchLhb(symbol);
                    break;
                case 'shareholder':
                    if (shareholderContent?.textContent.includes('加载中')) fetchShareholders(symbol);
                    break;
                case 'news':
                    if (newsContent?.textContent.includes('加载中')) fetchNews(symbol);
                    break;
                case 'quote':
                    if (quoteContent?.textContent.includes('加载中')) fetchRealtimeQuote(symbol);
                    // （可选）设置一个间隔来刷新报价数据
                    break;
                // K 线最初已加载
            }
        });
    });

    // --- 数据获取函数 ---

    // 1. 获取历史 K 线数据
    async function fetchHistoricalData(stockSymbol, period = 'daily', adjust = 'qfq', startDate = null, endDate = null) {
        // *** 在 AKTools /docs 中验证此 API 路径 ***
        const historyApiUrl = `${aktoolsApiBaseUrl}/api/public/stock_zh_a_hist`;
        const params = new URLSearchParams({ symbol: stockSymbol, period, adjust });
        if (startDate) params.append('start_date', startDate);
        if (!endDate) endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        params.append('end_date', endDate);

        // 专门为图表显示加载指示器
        if (chartLoadingElement) chartLoadingElement.style.display = 'block';
        if (myChart) myChart.clear(); // 如果存在，则清除之前的图表

        const data = await fetchData(`${historyApiUrl}?${params.toString()}`, chartLoadingElement, '获取K线数据');

        if (data && Array.isArray(data) && data.length > 0) {
            renderKlineChart(data); // 成功后渲染图表
        } else if (data === null) { // 显式检查获取错误
            if (chartLoadingElement) chartLoadingElement.textContent = '加载K线数据失败。请检查网络或AKTools服务。';
        } else { // 数据为空数组或意外格式
            if (chartLoadingElement) chartLoadingElement.textContent = '未找到符合条件的K线数据。';
        }
    }

    // 2. 获取公司信息
    async function fetchCompanyInfo(sym) {
        // *** 在 AKTools /docs 中验证此 API 路径 ***
        const apiUrl = `${aktoolsApiBaseUrl}/api/public/stock_individual_info_em?symbol=${sym}`;
        const data = await fetchData(apiUrl, companyInfoContent, '获取公司概况');

        if (data && Array.isArray(data) && data.length > 0) {
            let html = '<ul style="list-style: none; padding: 0;">';
            let stockName = `股票 ${sym}`; // 默认名称
            data.forEach(item => {
                 // *** 从实际 API 响应中验证数据键（“item”、“value”）***
                 const key = item['item'];
                 const value = item['value'];
                 html += `<li style="margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;"><strong>${key}:</strong> ${value || 'N/A'}</li>`;
                 if (key === '股票简称' || key === '名称') { // 更新标题名称
                     stockName = value;
                 }
            });
            html += '</ul>';
            if (companyInfoContent) companyInfoContent.innerHTML = html;
            if (stockNameElement) stockNameElement.textContent = stockName; // 更新主标题
        } else if (data !== null) { // 获取成功但没有数据
            if (companyInfoContent) companyInfoContent.textContent = '未能加载公司概况数据。';
        }
        // 如果数据为 null，则错误消息已由 fetchData 设置
    }

    // 3. 获取资金流向
    async function fetchFundFlow(sym) {
        // *** 在 AKTools /docs 中验证此 API 路径和参数名称（“stock”或“symbol”）***
        const apiUrl = `${aktoolsApiBaseUrl}/api/public/stock_individual_fund_flow?stock=${sym}`;
        const data = await fetchData(apiUrl, fundflowContent, '获取资金流向');

        if (data && Array.isArray(data) && data.length > 0) {
            // 假设第一项是最新的数据
            const latestFlow = data[0];
            // *** 从实际 API 响应中验证所有数据键 ***
            let html = `<p style="font-weight: bold; margin-bottom: 10px;">日期: ${latestFlow['日期'] || 'N/A'}</p>`;
            html += '<table class="simple-table">'; // 使用简单的表格以获得更好的对齐
            html += `<tr><td>主力净流入:</td><td>${latestFlow['主力净流入-净额'] || 'N/A'} (${latestFlow['主力净流入-净占比'] || 'N/A'}%)</td></tr>`;
            html += `<tr><td>超大单净流入:</td><td>${latestFlow['超大单净流入-净额'] || 'N/A'} (${latestFlow['超大单净流入-净占比'] || 'N/A'}%)</td></tr>`;
            html += `<tr><td>大单净流入:</td><td>${latestFlow['大单净流入-净额'] || 'N/A'} (${latestFlow['大单净流入-净占比'] || 'N/A'}%)</td></tr>`;
            html += `<tr><td>中单净流入:</td><td>${latestFlow['中单净流入-净额'] || 'N/A'} (${latestFlow['中单净流入-净占比'] || 'N/A'}%)</td></tr>`;
            html += `<tr><td>小单净流入:</td><td>${latestFlow['小单净流入-净额'] || 'N/A'} (${latestFlow['小单净流入-净占比'] || 'N/A'}%)</td></tr>`;
            html += '</table>';
            if (fundflowContent) fundflowContent.innerHTML = html;
            // 可选：在此处使用 latestFlow 数据渲染一个简单的图表
            // renderFundFlowChart(latestFlow);
        } else if (data !== null) {
            if (fundflowContent) fundflowContent.textContent = '未能加载资金流向数据。';
        }
    }

    // 4. 获取龙虎榜 (LHB)
    async function fetchLhb(sym) {
        // *** 在 AKTools /docs 中验证此 API 路径和参数（例如，日期范围？）***
        const apiUrl = `${aktoolsApiBaseUrl}/api/public/stock_lhb_detail_em?symbol=${sym}`; // 假设获取最新数据
        const data = await fetchData(apiUrl, lhbContent, '获取龙虎榜');

        if (lhbTableBody && lhbTableHead && data && Array.isArray(data) && data.length > 0) {
            lhbTableBody.innerHTML = ''; // 清除之前的数据
            lhbTableHead.innerHTML = ''; // 清除之前的标题

            // 从第一个数据项的键动态创建标题行
            // *** 从实际 API 响应中验证键 ***
            const headers = Object.keys(data[0]);
            let headerHtml = '<tr>';
            headers.forEach(key => headerHtml += `<th>${key}</th>`);
            headerHtml += '</tr>';
            lhbTableHead.innerHTML = headerHtml;

            // 填充数据行
            data.forEach(item => {
                let rowHtml = '<tr>';
                headers.forEach(key => {
                    // 使用键访问数据。处理 null/undefined。
                    const value = item[key];
                    rowHtml += `<td>${value !== null && value !== undefined ? value : 'N/A'}</td>`;
                });
                rowHtml += '</tr>';
                lhbTableBody.innerHTML += rowHtml;
            });
             if(lhbContent) lhbContent.style.display = 'none'; // 隐藏加载文本

        } else if (data !== null) {
             if (lhbContent) lhbContent.textContent = '最近无龙虎榜数据或加载失败。';
             if (lhbTableBody) lhbTableBody.innerHTML = ''; // 清除表体
             if (lhbTableHead) lhbTableHead.innerHTML = ''; // 清除表头
        }
         // 确保在错误或没有数据时显示加载文本
         if (lhbContent && (data === null || !data || data.length === 0)) {
             lhbContent.style.display = 'block';
         }
    }


    // 5. 获取股东信息
    async function fetchShareholders(sym) {
        // *** 在 AKTools /docs 中验证此 API 路径 ***
        // 常用端点：stock_gdfx_top_10_em（前 10 名）、stock_gdfx_free_top_10_em（前 10 名自由流通股）
        const apiUrl = `${aktoolsApiBaseUrl}/api/public/stock_gdfx_top_10_em?symbol=${sym}`;
        const data = await fetchData(apiUrl, shareholderContent, '获取股东信息');

        if (shareholderTableBody && shareholderTableHead && data && Array.isArray(data) && data.length > 0) {
            shareholderTableBody.innerHTML = '';
            shareholderTableHead.innerHTML = '';

             // *** 从实际 API 响应中验证键 ***
            const headers = Object.keys(data[0]);
            let headerHtml = '<tr>';
            // 您可能需要显式定义顺序和名称：
            // const displayHeaders = {'股东名称': '股东名称', '持股数量': '持股数(万股)', ...};
            headers.forEach(key => headerHtml += `<th>${key}</th>`);
            headerHtml += '</tr>';
            shareholderTableHead.innerHTML = headerHtml;

            data.forEach(item => {
                let rowHtml = '<tr>';
                headers.forEach(key => {
                    const value = item[key];
                    // 如果需要，格式化数字、百分比等
                    rowHtml += `<td>${value !== null && value !== undefined ? value : 'N/A'}</td>`;
                });
                rowHtml += '</tr>';
                shareholderTableBody.innerHTML += rowHtml;
            });
             if(shareholderContent) shareholderContent.style.display = 'none'; // 隐藏加载文本

        } else if (data !== null) {
             if (shareholderContent) shareholderContent.textContent = '未能加载股东信息。';
             if (shareholderTableBody) shareholderTableBody.innerHTML = '';
             if (shareholderTableHead) shareholderTableHead.innerHTML = '';
        }
         if (shareholderContent && (data === null || !data || data.length === 0)) {
             shareholderContent.style.display = 'block';
         }
    }

    // 6. 获取新闻
    async function fetchNews(sym) {
        // *** 在 AKTools /docs 中验证此 API 路径 ***
        const apiUrl = `${aktoolsApiBaseUrl}/api/public/stock_news_em?symbol=${sym}`;
        const data = await fetchData(apiUrl, newsContent, '获取相关资讯');

        if (newsList && data && Array.isArray(data) && data.length > 0) {
            newsList.innerHTML = ''; // 清除之前的列表
            data.forEach(item => {
                 // *** 从实际 API 响应中验证键（“title”、“url”、“datetime”）***
                 const title = item['title'];
                 const url = item['url'];
                 const dateTime = item['datetime'];

                 if (title && url) { // 仅添加具有标题和 URL 的新闻
                     const li = document.createElement('li');
                     const link = document.createElement('a');
                     link.href = url;
                     link.textContent = title;
                     link.target = '_blank'; // 在新选项卡中打开
                     link.rel = 'noopener noreferrer'; // 安全最佳实践
                     li.appendChild(link);

                     if (dateTime) {
                         const timeSpan = document.createElement('span');
                         timeSpan.textContent = ` (${dateTime})`;
                         timeSpan.style.fontSize = '0.9em';
                         timeSpan.style.color = '#666';
                         timeSpan.style.marginLeft = '10px';
                         li.appendChild(timeSpan);
                     }
                     newsList.appendChild(li);
                 }
            });
             if(newsContent) newsContent.style.display = 'none'; // 隐藏加载文本
        } else if (data !== null) {
             if (newsContent) newsContent.textContent = '未能加载相关资讯。';
             if (newsList) newsList.innerHTML = '';
        }
        if (newsContent && (data === null || !data || data.length === 0)) {
             newsContent.style.display = 'block';
         }
    }

    // 7. 获取实时报价
    async function fetchRealtimeQuote(sym) {
        // 使用现货 API，需要过滤
        // *** 在 AKTools /docs 中验证此 API 路径 ***
        const apiUrl = `${aktoolsApiBaseUrl}/api/public/stock_zh_a_spot_em`;
        const allQuotes = await fetchData(apiUrl, quoteContent, '获取实时行情');

        if (allQuotes && Array.isArray(allQuotes)) {
            // *** 验证股票代码的键（“代码”）***
            const quoteData = allQuotes.find(q => q['代码'] === sym);

            if (quoteData) {
                let html = '<ul style="list-style: none; padding: 0; column-count: 2; column-gap: 20px;">'; // 使用列以获得更好的布局
                // *** 从实际 API 响应中验证键并选择要显示的字段 ***
                const fieldsToShow = ['最新价', '涨跌额', '涨跌幅', '今开', '最高', '最低', '昨收', '成交量', '成交额', '换手率', '市盈率-动态', '市净率', '总市值', '流通市值', '振幅', '委比', '量比', '买一价', '卖一价', '买一量', '卖一量']; // 如果需要，添加更多字段
                for (const key in quoteData) {
                    if (fieldsToShow.includes(key)) {
                        let value = quoteData[key];
                        let displayValue = value !== null && value !== undefined ? value : 'N/A';
                        // 基本格式化
                        if ((key.includes('幅') || key.includes('率') || key.includes('比')) && typeof value === 'number') {
                            displayValue = `${value.toFixed(2)}%`; // 添加 % 并格式化小数
                        } else if (key.includes('市值') || key.includes('额')) {
                            // 添加基本的大数字格式（可选）
                            displayValue = formatLargeNumber(value);
                        } else if (key.includes('成交量') || key.includes('量')) {
                             displayValue = formatLargeNumber(value, 0); // 格式化成交量，不带小数
                        }


                        html += `<li style="margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;"><strong>${key}:</strong> ${displayValue}</li>`;
                    }
                }
                html += '</ul>';
                if (quoteContent) quoteContent.innerHTML = html;
            } else {
                 if (quoteContent) quoteContent.textContent = `在实时行情列表中未找到代码 ${sym}。`;
            }
        } else if (allQuotes !== null) {
            if (quoteContent) quoteContent.textContent = '加载实时行情列表失败或为空。';
        }
        // 错误由 fetchData 处理
    }


    // --- ECharts 渲染函数 ---
    function renderKlineChart(rawData) {
        if (!chartContainer || !rawData || rawData.length === 0) {
            console.warn("Chart container or data missing for renderKlineChart");
            if (chartLoadingElement) chartLoadingElement.textContent = '数据不足或图表容器不存在。';
            return;
        }
        if (chartLoadingElement) chartLoadingElement.style.display = 'none'; // 隐藏加载文本

        // 初始化或重用 ECharts 实例
        if (!myChart) {
             myChart = echarts.init(chartContainer);
             // 仅添加一次resize监听器
             window.addEventListener('resize', () => {
                if (myChart) {
                    myChart.resize();
                }
            });
        } else {
             myChart.clear(); // 在设置新选项之前清除之前的选项
        }


        // 数据处理：将 AKShare 格式转换为 ECharts 格式
        // Akshare: {日期, 开盘, 收盘, 最高, 最低, 成交量, ...}
        // ECharts K 线: [date, open, close, low, high]
        // ECharts 成交量: [index, volume, sign(+1 for rise, -1 for fall)]
        const processedData = { dates: [], kData: [], volumes: [] };
        for (let i = 0; i < rawData.length; i++) {
            const item = rawData[i];
             // *** 从实际 API 响应中验证键 ***
             const date = item['日期']; // 应该是 ECharts 能够理解的“YYYY-MM-DD”或类似格式
             const open = parseFloat(item['开盘']);
             const close = parseFloat(item['收盘']);
             const low = parseFloat(item['最低']);
             const high = parseFloat(item['最高']);
             const volume = parseFloat(item['成交量']);

             // 基本数据验证
             if (!date || isNaN(open) || isNaN(close) || isNaN(low) || isNaN(high) || isNaN(volume)) {
                  console.warn("Skipping invalid data point:", item);
                  continue;
             }

            processedData.dates.push(date);
            processedData.kData.push([open, close, low, high]);
            processedData.volumes.push([i, volume, open > close ? -1 : 1]); // index, volume, sign
        }

        if (processedData.dates.length === 0) {
             if (chartLoadingElement) chartLoadingElement.textContent = '处理后无有效K线数据。';
             if (chartLoadingElement) chartLoadingElement.style.display = 'block';
             return;
        }


        // 计算移动平均线（使用收盘价）
        const ma5 = calculateMA(5, processedData.kData.map(k => k[1])); // 基于收盘价的 MA（索引 1）
        const ma10 = calculateMA(10, processedData.kData.map(k => k[1]));
        const ma20 = calculateMA(20, processedData.kData.map(k => k[1]));

        // ECharts 选项配置
        const option = {
            // backgroundColor: '#fff', // 可选的背景颜色
            animation: false,
            legend: { bottom: 10, left: 'center', data: ['日K', 'MA5', 'MA10', 'MA20'] },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                // 简化的工具提示，根据需要进行自定义
                formatter: function (params) {
                     const dataIndex = params[0].dataIndex;
                     const kItem = processedData.kData[dataIndex]; // [open, close, low, high]
                     let ret = `${processedData.dates[dataIndex]}<br/>`;
                     ret += `开: ${kItem[0].toFixed(2)} 收: ${kItem[1].toFixed(2)}<br/>`;
                     ret += `低: ${kItem[2].toFixed(2)} 高: ${kItem[3].toFixed(2)}<br/>`;
                     params.forEach(p => {
                         if (p.seriesName.startsWith('MA')) {
                              ret += `${p.seriesName}: ${p.value !== '-' ? parseFloat(p.value).toFixed(2) : '-'}<br/>`;
                         } else if (p.seriesName === 'Volume') {
                             ret += `成交量: ${formatLargeNumber(p.value[1], 0)}<br/>`;
                         }
                     });
                     return ret;
                }
            },
            axisPointer: { link: [{ xAxisIndex: 'all' }], label: { backgroundColor: '#777' } },
            toolbox: {
                 right: 20,
                feature: {
                    dataZoom: { yAxisIndex: false },
                    brush: { type: ['lineX', 'clear'] },
                    restore: {},
                    saveAsImage: {}
                }
            },
            grid: [
                { left: '8%', right: '8%', height: '50%' }, // K 线图
                { left: '8%', right: '8%', top: '65%', height: '16%' } // 成交量图
            ],
            xAxis: [
                { type: 'category', data: processedData.dates, scale: true, boundaryGap: false, axisLine: { onZero: false }, splitLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, min: 'dataMin', max: 'dataMax', axisPointer: { z: 100 } },
                { type: 'category', gridIndex: 1, data: processedData.dates, scale: true, boundaryGap: false, axisLine: { onZero: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: true }, min: 'dataMin', max: 'dataMax' }
            ],
            yAxis: [
                { scale: true, splitArea: { show: false }, axisLabel: { inside: false, formatter: '{value}\n' } }, // 价格轴
                { scale: true, gridIndex: 1, splitNumber: 2, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } } // 成交量轴
            ],
            dataZoom: [
                { type: 'inside', xAxisIndex: [0, 1], start: Math.max(0, 100 - (365 / processedData.dates.length * 100)), end: 100 }, // 默认视图 ~1 年（如果可能）
                { show: true, xAxisIndex: [0, 1], type: 'slider', top: '85%', start: Math.max(0, 100 - (365 / processedData.dates.length * 100)), end: 100 }
            ],
            series: [
                { name: '日K', type: 'candlestick', data: processedData.kData, itemStyle: { color: '#FD1050', color0: '#0CF49B', borderColor: '#FD1050', borderColor0: '#0CF49B' } }, // 红色上涨，绿色下跌
                { name: 'MA5', type: 'line', data: ma5, smooth: true, showSymbol: false, lineStyle: { opacity: 0.7, width: 1 } },
                { name: 'MA10', type: 'line', data: ma10, smooth: true, showSymbol: false, lineStyle: { opacity: 0.7, width: 1 } },
                { name: 'MA20', type: 'line', data: ma20, smooth: true, showSymbol: false, lineStyle: { opacity: 0.7, width: 1 } },
                { name: 'Volume', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: processedData.volumes, itemStyle: { color: ({ data }) => (data[2] === 1 ? '#FD1050' : '#0CF49B') } } // index, volume, sign
            ]
        };

        // 将选项应用于图表
        myChart.setOption(option);
    }

    // --- 辅助函数：计算移动平均线 ---
    function calculateMA(dayCount, data) { // data 应该是数字数组（例如，收盘价）
        var result = [];
        for (var i = 0, len = data.length; i < len; i++) {
            if (i < dayCount - 1) {
                result.push('-'); // 对于不充分的数据点，使用“-”
                continue;
            }
            var sum = 0;
            for (var j = 0; j < dayCount; j++) {
                sum += data[i - j];
            }
            result.push(+(sum / dayCount).toFixed(2)); // 计算平均值并格式化
        }
        return result;
    }

     // --- 辅助函数：格式化大数字（基本） ---
     function formatLargeNumber(num, decimalPlaces = 2) {
         if (num === null || num === undefined || isNaN(num)) return 'N/A';
         num = Number(num);
         if (Math.abs(num) >= 1e8) { // 亿
             return (num / 1e8).toFixed(decimalPlaces) + '亿';
         } else if (Math.abs(num) >= 1e4) { // 万
             return (num / 1e4).toFixed(decimalPlaces) + '万';
         } else {
             return num.toFixed(decimalPlaces);
         }
     }


    // --- 初始数据加载 ---
    // 首先加载 K 线（默认所有历史记录）和基本信息
    await fetchHistoricalData(symbol); // 使用 await 确保 K 线在可能需要的其他操作之前加载
    await fetchCompanyInfo(symbol); // 还要最初加载公司信息以获取名称
    fetchRealtimeQuote(symbol); // 加载报价，但无需等待

    // --- 可选：K 线时间范围选择器逻辑 ---
    if (rangeSelector) {
        rangeSelector.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON') {
                const range = event.target.dataset.range;
                let startDate = null;
                const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const now = new Date();

                // 更新活动按钮样式
                rangeSelector.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');

                if (range === '1m') startDate = new Date(new Date(now).setMonth(now.getMonth() - 1)).toISOString().slice(0, 10).replace(/-/g, '');
                else if (range === '3m') startDate = new Date(new Date(now).setMonth(now.getMonth() - 3)).toISOString().slice(0, 10).replace(/-/g, '');
                else if (range === '1y') startDate = new Date(new Date(now).setFullYear(now.getFullYear() - 1)).toISOString().slice(0, 10).replace(/-/g, '');
                else if (range === '3y') startDate = new Date(new Date(now).setFullYear(now.getFullYear() - 3)).toISOString().slice(0, 10).replace(/-/g, '');
                // “all”范围意味着 startDate 保持为 null

                // 重新获取并渲染所选范围的 K 线数据
                fetchHistoricalData(symbol, 'daily', 'qfq', startDate, endDate);
            }
        });
    }

}); // DOMContentLoaded 结束
