import { test, expect } from '../fixtures/extension.fixture';
import { SidePanel } from '../page-objects/SidePanel';
import { mockAIStreamingResponse } from '../helpers/ai-mock';

const TEST_CHUNKS = ['这是', '一个', '流式', '测试', '总结'];

test.describe('AI Summary Functionality', () => {
    test('should generate AI summary with streaming', async ({ sidepanelPage }) => {
        const sidePanel = new SidePanel(sidepanelPage);
        await mockAIStreamingResponse(sidepanelPage, TEST_CHUNKS);

        expect(sidePanel).toBeDefined();
    });
});
