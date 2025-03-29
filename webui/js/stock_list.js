// js/stock_list.js (修改后的版本)

document.addEventListener('DOMContentLoaded', () => {
    const stockTableBody = document.getElementById('stock-table-body');
    const loadingIndicator = document.querySelector('main h2');
    const lastUpdatedElement = document.getElementById('last-updated');
    const aktoolsApiBaseUrl = 'http://127.0.0.1:8080'; // 确认 AKTools 地址

    // --- Function to fetch and display stock data ---
    async function fetchStockList() {
        const apiUrl = `${aktoolsApiBaseUrl}/api/public/stock_zh_a_spot_em`; // 实时行情接口

        try {
            console.log(`Fetching data from: ${apiUrl}`);
            loadingIndicator.textContent = '正在加载数据...';
            stockTableBody.innerHTML = ''; // 清空旧数据

            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            console.log("Data received:", data);

            if (data && Array.isArray(data) && data.length > 0) {
                loadingIndicator.style.display = 'none';

                data.forEach((stock, index) => {
                    const row = stockTableBody.insertRow();
                    const symbol = stock['代码']; // 获取股票代码

                    // *** 新增：为行添加 data-symbol 属性 ***
                    if (symbol) {
                        row.dataset.symbol = symbol; // 存储股票代码
                        row.style.cursor = 'pointer'; // *** 新增：鼠标悬停时显示手型光标 ***
                        row.title = `点击查看 ${stock['名称'] || symbol} 的详细行情`; // *** 新增：添加提示信息 ***
                    }

                    // 填充单元格 (保持不变，根据实际API返回调整key)
                    row.insertCell().textContent = stock['序号'] !== undefined ? stock['序号'] : index + 1;
                    row.insertCell().textContent = symbol || 'N/A';
                    row.insertCell().textContent = stock['名称'] || 'N/A';
                    row.insertCell().textContent = stock['最新价'] || 'N/A';
                    row.insertCell().textContent = stock['涨跌额'] || 'N/A';
                    const changePercent = stock['涨跌幅'];
                    row.insertCell().textContent = changePercent !== undefined ? `${changePercent}%` : 'N/A';
                    row.insertCell().textContent = stock['成交量'] || 'N/A';
                    row.insertCell().textContent = stock['成交额'] || 'N/A';
                    const turnoverRate = stock['换手率'];
                    row.insertCell().textContent = turnoverRate !== undefined ? `${turnoverRate}%` : 'N/A';
                    row.insertCell().textContent = stock['市盈率-动态'] || 'N/A';
                    // ... 其他单元格
                });

                lastUpdatedElement.textContent = `最后更新时间: ${new Date().toLocaleString()}`;
            } else {
                loadingIndicator.textContent = '未能加载数据或数据为空。';
            }
        } catch (error) {
            console.error("Error fetching stock list:", error);
            loadingIndicator.textContent = `加载数据失败: ${error.message}`;
            stockTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: red;">加载错误，请检查AKTools服务是否运行或网络连接。</td></tr>`;
        }
    }

    // --- 新增：为 tbody 添加点击事件监听器 (事件委托) ---
    stockTableBody.addEventListener('click', (event) => {
        // closest('tr') 会找到被点击元素（td）所在的最近的父级 tr 元素
        const clickedRow = event.target.closest('tr');

        if (clickedRow && clickedRow.dataset.symbol) {
            const symbol = clickedRow.dataset.symbol;
            console.log(`Navigating to details for symbol: ${symbol}`);
            // 跳转到详情页面，并将股票代码作为 URL 参数传递
            window.location.href = `stock_detail.html?symbol=${symbol}`;
        }
    });

    // --- Initial data fetch ---
    fetchStockList();

    // --- Optional: Auto-refresh ---
    // setInterval(fetchStockList, 60000);
});
