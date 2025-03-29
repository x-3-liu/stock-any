// Wait until the HTML document is fully loaded and parsed
document.addEventListener('DOMContentLoaded', () => {
    const stockTableBody = document.getElementById('stock-table-body');
    const loadingIndicator = document.querySelector('main h2'); // Get the "Loading..." text
    const lastUpdatedElement = document.getElementById('last-updated');
    const aktoolsApiBaseUrl = 'http://127.0.0.1:8080'; // Your AKTools server address

    // --- Function to fetch and display stock data ---
    async function fetchStockList() {
        // Construct the API URL for the A-share spot market data
        // IMPORTANT: Check AKTools documentation or its /docs endpoint for the exact URL path!
        // It's likely something like '/api/public/stock_zh_a_spot_em' or similar.
        const apiUrl = `${aktoolsApiBaseUrl}/api/public/stock_zh_a_spot_em`; // *** ADJUST THIS PATH AS NEEDED ***

        try {
            console.log(`Fetching data from: ${apiUrl}`);
            loadingIndicator.textContent = '正在加载数据...'; // Update loading text
            stockTableBody.innerHTML = ''; // Clear previous data

            const response = await fetch(apiUrl);

            if (!response.ok) {
                // Handle HTTP errors (e.g., 404 Not Found, 500 Internal Server Error)
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json(); // Parse the JSON response from AKTools

            console.log("Data received:", data);

            // --- Process and Display Data ---
            if (data && Array.isArray(data) && data.length > 0) {
                loadingIndicator.style.display = 'none'; // Hide loading indicator

                data.forEach((stock, index) => {
                    const row = stockTableBody.insertRow(); // Create a new table row

                    // Populate cells - Adapt based on actual keys in the JSON response!
                    // Check your browser's developer console (F12 -> Network tab)
                    // to see the exact structure of the JSON returned by AKTools.
                    row.insertCell().textContent = stock['序号'] !== undefined ? stock['序号'] : index + 1; // Use index if '序号' missing
                    row.insertCell().textContent = stock['代码'] || 'N/A';
                    row.insertCell().textContent = stock['名称'] || 'N/A';
                    row.insertCell().textContent = stock['最新价'] || 'N/A';
                    row.insertCell().textContent = stock['涨跌额'] || 'N/A';
                    // Format percentage if needed
                    const changePercent = stock['涨跌幅'];
                    row.insertCell().textContent = changePercent !== undefined ? `${changePercent}%` : 'N/A';
                    row.insertCell().textContent = stock['成交量'] || 'N/A'; // Note: units might be '手'
                    row.insertCell().textContent = stock['成交额'] || 'N/A';
                    const turnoverRate = stock['换手率'];
                    row.insertCell().textContent = turnoverRate !== undefined ? `${turnoverRate}%` : 'N/A';
                    row.insertCell().textContent = stock['市盈率-动态'] || 'N/A'; // Key might differ slightly

                     // Add more cells as needed matching your <thead>
                });

                // Update last updated time
                lastUpdatedElement.textContent = `最后更新时间: ${new Date().toLocaleString()}`;

            } else {
                loadingIndicator.textContent = '未能加载数据或数据为空。';
                console.warn("Received data is empty or not in expected format:", data);
            }

        } catch (error) {
            console.error("Error fetching stock list:", error);
            loadingIndicator.textContent = `加载数据失败: ${error.message}`;
            stockTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: red;">加载错误，请检查AKTools服务是否运行或网络连接。</td></tr>`; // Adjust colspan
        }
    }

    // --- Initial data fetch when the page loads ---
    fetchStockList();

    // --- Optional: Set up auto-refresh (e.g., every 60 seconds) ---
    // setInterval(fetchStockList, 60000); // Refresh every 60 seconds
});
