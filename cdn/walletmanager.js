export class WalletManager {
    constructor(extensionId) {
        if (!extensionId) {
            throw new Error("Extension ID is missing. Please provide a valid Extension ID.");
        }
        this.extensionId = extensionId;
    }

    async connectWallet() {
        try {
            const response = await this.sendMessageToExtension("request_connection");
            if (response && response.success) {
                console.log("Approval popup opened successfully. Waiting for user approval...");
                const authToken = response.authToken;
                if (authToken) {
                    console.log("User approved. Auth token received:", authToken);
                    return authToken;
                } else {
                    throw new Error("User did not approve the transaction.");
                }
            } else {
                throw new Error(response.error || "Failed to open approval popup.");
            }
        } catch (error) {
            console.error("Error connecting wallet:", error);
            this.showErrorMessage(error.message || "An error occurred during wallet connection.");
        }
    }

    async detectExtension() {
        try {
            const response = await this.sendMessageToExtension('detect_extension');
            return response && response.success;
        } catch (error) {
            console.error("Error detecting wallet extension:", error);
            return false;
        }
    }

    async getAuth() {
        try {
            const response = await this.sendMessageToExtension('check_auth');
            return response;
        } catch (error) {
            console.error("Error checking auth:", error);
            return false;
        }
    }

    async fetchAndUpdateBalance() {
        const loader = document.getElementById('balance-loader');
        if (loader) {
            loader.style.display = 'inline-block'; // Show loader before fetching balance
        }

        try {
            const { authToken } = await chrome.storage.sync.get('authToken');
            if (!authToken) {
                console.error('Authorization token is missing');
                this.redirectToLogin();
                return;
            }

            const response = await fetch('https://dev-wallet-api.dubaicustoms.network/api/ext-balance', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.ok) {
                const { balance } = await response.json();
                document.getElementById('balance').textContent = `AED ${this.formatAmount(parseFloat(balance).toFixed(3))}`;
            } else if (response.status === 401) {
                console.error('Token expired or invalid, redirecting to login.');
                this.redirectToLogin();
            } else {
                console.error('Failed to fetch balance:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching balance:', error);
        } finally {
            if (loader) {
                loader.style.display = 'none'; // Hide loader after balance is fetched
            }
        }
    }

    sendMessageToExtension(action, data = {}) {
        return new Promise((resolve, reject) => {
            console.log(`Sending message to extension with action: ${action}`, { action, ...data });
            
            chrome.runtime.sendMessage(this.extensionId, { action, ...data }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error in sendMessageToExtension:", chrome.runtime.lastError.message);
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                console.log("Response received from background:", response);
                resolve(response);
            });
        });
    }

    showErrorMessage(message) {
        Swal.fire({
            text: message,
            icon: "warning",
            confirmButtonColor: "#3085d6",
            confirmButtonText: 'OK'
        });
    }

    redirectToLogin() {
        // Implement redirection to login
        window.location.href = '/login.html'; // Replace with the actual login URL if needed
    }

    formatAmount(amount) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
}
