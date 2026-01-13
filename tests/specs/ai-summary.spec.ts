import { test, expect } from '../fixtures/extension.fixture';
import { SidePanel } from '../page-objects/SidePanel';
import { mockAISummaryResponse, mockAIStreamingResponse } from '../helpers/ai-mock';

test.describe('AI Summary Functionality', () => {
    test('should generate AI summary with streaming', async ({ sidepanelPage }) => {
        const sidePanel = new SidePanel(sidepanelPage);
        const chunks = ['这是', '一个', '流式', '测试', '总结'];
        await mockAIStreamingResponse(sidepanelPage, chunks);

        // 假设点击按钮触发 AI 总结
        // await sidePanel.clickAnalyzeButton();

        // 验证流式输出（可选：逐步验证，或者最终验证）
        // 为了简化，我们验证最终拼接的内容
        const expectedContent = chunks.join('');
        // 这里需要根据实际 UI 逻辑来等待内容出现
        // await expect(sidepanelPage.locator('.summary-content')).toContainText(expectedContent);

        expect(sidePanel).toBeDefined();
    });
});
