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

    async checkAuth() {
        try{
            const response = await this.sendMessageToExtension('check_auth');
            return response;
        } catch (error) {
            console.error("Error checking auth:", error);
            return false;
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
}
