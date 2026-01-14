```javascript
// 测试Web3钱包插件（如MetaMask）的完整流程
const { test, expect } = require('@playwright/test');

test.describe('MetaMask 集成测试', () => {
  let extensionContext;
  let popupPage;
  let notificationPage;
  
  test.beforeEach(async ({ browser }) => {
    // 1. 启动带MetaMask的浏览器
    const extensionPath = './metamask-extension';
    
    extensionContext = await browser.newContext({
      viewport: null,
      storageState: './metamask-test-state.json', // 预配置的账户
      // Chrome特定的扩展加载
      ...(browser.browserType().name() === 'chromium' && {
        launchOptions: {
          args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`
          ]
        }
      })
    });
  });
  
  test('连接钱包并签署交易', async () => {
    // 2. 访问DApp网站
    const dappPage = await extensionContext.newPage();
    await dappPage.goto('https://uniswap.org');
    
    // 3. 点击DApp的"连接钱包"按钮
    await dappPage.click('button:has-text("Connect Wallet")');
    await dappPage.click('text="MetaMask"');
    
    // 4. 监听MetaMask弹窗（连接请求）
    const [popup] = await Promise.all([
      extensionContext.waitForEvent('page', page => 
        page.url().includes('chrome-extension://') &&
        page.url().includes('notification.html')
      ),
      // 点击连接会触发MetaMask弹窗
    ]);
    
    notificationPage = popup;
    
    // 5. 在MetaMask弹窗中点击"下一步"和"连接"
    await notificationPage.click('button:has-text("Next")');
    await notificationPage.click('button:has-text("Connect")');
    
    // 6. 返回DApp页面，应该已连接成功
    await expect(dappPage.locator('text="Connected"')).toBeVisible();
    
    // 7. 在DApp执行交易
    await dappPage.fill('#amount', '0.1');
    await dappPage.click('button:has-text("Swap")');
    
    // 8. 再次等待MetaMask交易确认弹窗
    const [confirmPopup] = await Promise.all([
      extensionContext.waitForEvent('page'),
      // 交易会触发新的弹窗
    ]);
    
    // 9. 在确认弹窗中点击"确认"
    await confirmPopup.click('button:has-text("Confirm")');
    
    // 10. 验证交易完成
    await expect(dappPage.locator('text="Transaction confirmed"')).toBeVisible();
  });
});
```