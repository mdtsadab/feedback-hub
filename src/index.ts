export interface Env {
  AI: Ai;
  FEEDBACK_WORKFLOW: Workflow;
  DB: D1Database;
}

export { FeedbackWorkflow } from "./workflow";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // =========================
    // AI CHAT API
    // =========================
    if (url.pathname === "/api/chat" && request.method === "POST") {
      const body = (await request.json()) as { message?: string };
      const message = body.message;

      if (!message) {
        return Response.json({ error: "Message required" }, { status: 400 });
      }

      const result = await env.AI.run(
        "@cf/meta/llama-3-8b-instruct",
        {
          messages: [
            {
              role: "system",
              content:
                "You analyze Cloudflare outage feedback and answer user questions."
            },
            { role: "user", content: message }
          ],
          max_tokens: 256
        }
      );

      return Response.json({
        success: true,
        response: result.response ?? result
      });
    }

    // =========================
    // FEEDBACK WORKFLOW TRIGGER
    // =========================
    if (url.pathname === "/api/feedback" && request.method === "POST") {
      const body = (await request.json()) as {
        message?: string;
        source?: string;
        product?: string;
      };

      if (!body.message) {
        return Response.json(
          { error: "Feedback message required" },
          { status: 400 }
        );
      }

      const instance = await env.FEEDBACK_WORKFLOW.create({
        params: {
          message: body.message,
          source: body.source,
          product: body.product
        }
      });

      const { results } = await env.DB.prepare(
        "SELECT * FROM feedback ORDER BY created_at DESC"
      ).all();

      return Response.json({
        success: true,
        workflowId: instance.id
      });
    }

    // =========================
    // DEFAULT UI
    // =========================
    return new Response(HTML_CONTENT, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloudflare Feedback Hub</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div id="app"></div>

  <script>
    const feedbackData = [
      { id: 1, source: 'GitHub', product: 'Argo Smart Routing', sentiment: 'negative', urgency: 'critical', timestamp: '2025-11-18T14:30:00', content: 'Argo Smart Routing went down during the outage. Smart routing updates and analytics were offline. This caused major traffic routing issues.', theme: 'outage_impact', region: 'US-East' },
      { id: 2, source: 'Discord', product: 'Argo Smart Routing', sentiment: 'negative', urgency: 'high', timestamp: '2025-11-18T14:45:00', content: 'ASR analytics are broken post-outage. Performance metrics showing incorrect data for the last 2 hours.', theme: 'data_corruption', region: 'EU' },
      { id: 3, source: 'Support Tickets', product: 'Argo Smart Routing', sentiment: 'negative', urgency: 'critical', timestamp: '2025-11-18T15:00:00', content: 'Multiple customers reporting Argo Smart Routing failures. Real-time routing decisions unavailable. Site performance degraded 35-50%.', theme: 'performance_impact', region: 'Global' },
      { id: 4, source: 'Twitter/X', product: 'Argo Smart Routing', sentiment: 'negative', urgency: 'high', timestamp: '2025-11-18T15:15:00', content: 'Why is Argo Smart Routing not helping? My site is still slow even with it enabled. The outage broke something.', theme: 'feature_broken', region: 'APAC' },
      { id: 5, source: 'Community Forum', product: 'Argo Smart Routing', sentiment: 'neutral', urgency: 'medium', timestamp: '2025-11-18T16:00:00', content: 'Is anyone else experiencing issues with Argo Smart Routing after the November 18 incident?', theme: 'measurement_issue', region: 'US-West' },
      { id: 6, source: 'Email', product: 'Argo Smart Routing', sentiment: 'negative', urgency: 'critical', timestamp: '2025-11-18T16:30:00', content: 'Customer complaint: Argo Smart Routing failed to route around congestion during outage. Expected intelligent routing, got nothing.', theme: 'core_function_failed', region: 'Global' },
      { id: 7, source: 'GitHub', product: 'Workers', sentiment: 'negative', urgency: 'high', timestamp: '2025-11-18T14:20:00', content: 'Workers deployments failing. Build configuration system issue spreading to dependent services.', theme: 'outage_impact', region: 'Global' },
      { id: 8, source: 'Support Tickets', product: 'Dashboard', sentiment: 'negative', urgency: 'high', timestamp: '2025-11-18T14:50:00', content: 'Dashboard API endpoints returning 503 errors. Control plane offline. Unable to monitor infrastructure.', theme: 'outage_impact', region: 'Global' }
    ];

    let activeTab = 'dashboard';
    let selectedProduct = 'all';
    let chatMessages = [];
    let isLoading = false;

    function getFiltered() {
      return selectedProduct === 'all' 
        ? feedbackData 
        : feedbackData.filter(f => f.product === selectedProduct);
    }

    async function sendChatMessage(userMessage) {
      if (!userMessage.trim() || isLoading) return;

      isLoading = true;
      chatMessages.push({ role: 'user', content: userMessage });
      
      const chatInput = document.getElementById('chat-input');
      if (chatInput) chatInput.value = '';

      renderChatTab();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage })
        });

        const data = await response.json();
        
        if (data.success) {
          const aiResponse = data.response || data.message || 'No response received';
          chatMessages.push({ role: 'assistant', content: String(aiResponse) });
        } else {
          chatMessages.push({ role: 'assistant', content: 'Error: ' + (data.error || 'Unknown error') });
        }
      } catch (error) {
        chatMessages.push({ role: 'assistant', content: 'Error connecting to AI: ' + error.message });
      }

      isLoading = false;
      renderChatTab();
    }

    function renderChatTab() {
      const chatContainer = document.getElementById('chat-messages');
      if (!chatContainer) return;

      chatContainer.innerHTML = chatMessages.map(msg => \`
        <div class="mb-4">
          <div class="\${msg.role === 'user' ? 'text-right' : 'text-left'}">
            <div class="\${msg.role === 'user' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-900'} rounded-lg p-3 inline-block max-w-xs">
              <p class="text-sm">\${msg.content}</p>
            </div>
          </div>
        </div>
      \`).join('');

      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function render() {
      const filtered = getFiltered();
      const negCount = filtered.filter(f => f.sentiment === 'negative').length;
      const criticalCount = filtered.filter(f => f.urgency === 'critical').length;

      let html = \`
        <div class="min-h-screen bg-gray-50">
          <!-- Header -->
          <div class="bg-white border-b border-gray-300 sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-6 py-6">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span class="text-white text-lg">⚡</span>
                </div>
                <div>
                  <h1 class="text-3xl font-bold text-gray-900">Cloudflare Feedback Hub</h1>
                  <p class="text-gray-600">Real-time feedback aggregation & AI analysis</p>
                </div>
              </div>

              <div class="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3 mb-4">
                <span class="text-red-600 text-lg">⚠️</span>
                <div>
                  <p class="font-semibold text-red-800">November 18, 2025 Outage Impact</p>
                  <p class="text-red-700 text-sm">Argo Smart Routing and multiple services affected. Dashboard showing \${filtered.length} feedback items.</p>
                </div>
              </div>

              <!-- Tabs -->
              <div class="flex gap-4 border-t border-gray-300 pt-4 overflow-x-auto">
                <button onclick="setTab('dashboard')" class="px-4 py-2 font-medium whitespace-nowrap \${activeTab === 'dashboard' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-600'} hover:text-gray-900">Dashboard</button>
                <button onclick="setTab('feedback')" class="px-4 py-2 font-medium whitespace-nowrap \${activeTab === 'feedback' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-600'} hover:text-gray-900">Feedback</button>
                <button onclick="setTab('analysis')" class="px-4 py-2 font-medium whitespace-nowrap \${activeTab === 'analysis' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-600'} hover:text-gray-900">Analysis</button>
                <button onclick="setTab('workflow')" class="px-4 py-2 font-medium whitespace-nowrap \${activeTab === 'workflow' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-600'} hover:text-gray-900">Workflow</button>
                <button onclick="setTab('chat')" class="px-4 py-2 font-medium whitespace-nowrap \${activeTab === 'chat' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-600'} hover:text-gray-900">AI Chat</button>
              </div>
            </div>
          </div>

          <!-- Main Content -->
          <div class="max-w-7xl mx-auto px-6 py-8">
      \`;

      if (activeTab === 'dashboard') {
        html += \`
          <!-- Product Filter -->
          <div class="mb-6 flex gap-2">
            <button onclick="setProduct('all')" class="px-4 py-2 rounded-lg font-medium \${selectedProduct === 'all' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300'} hover:border-orange-300">All Products</button>
            <button onclick="setProduct('Argo Smart Routing')" class="px-4 py-2 rounded-lg font-medium \${selectedProduct === 'Argo Smart Routing' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300'} hover:border-orange-300">Argo Smart Routing</button>
            <button onclick="setProduct('Workers')" class="px-4 py-2 rounded-lg font-medium \${selectedProduct === 'Workers' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300'} hover:border-orange-300">Workers</button>
            <button onclick="setProduct('Dashboard')" class="px-4 py-2 rounded-lg font-medium \${selectedProduct === 'Dashboard' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300'} hover:border-orange-300">Dashboard</button>
          </div>

          <!-- KPI Cards -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-white rounded-lg p-6 border border-gray-300">
              <p class="text-gray-600 text-sm font-medium mb-2">Total Feedback Items</p>
              <p class="text-4xl font-bold text-gray-900">\${filtered.length}</p>
            </div>
            <div class="bg-white rounded-lg p-6 border border-gray-300">
              <p class="text-gray-600 text-sm font-medium mb-2">Avg Sentiment</p>
              <p class="text-3xl font-bold text-red-600">Negative</p>
              <p class="text-xs text-gray-500 mt-1">85% of feedback</p>
            </div>
            <div class="bg-white rounded-lg p-6 border border-gray-300">
              <p class="text-gray-600 text-sm font-medium mb-2">Critical Issues</p>
              <p class="text-4xl font-bold text-red-600">\${criticalCount}</p>
            </div>
            <div class="bg-white rounded-lg p-6 border border-gray-300">
              <p class="text-gray-600 text-sm font-medium mb-2">Affected Regions</p>
              <p class="text-4xl font-bold text-orange-600">5</p>
              <p class="text-xs text-gray-500 mt-1">Global impact</p>
            </div>
          </div>

          <!-- Charts Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <!-- Feedback by Source -->
            <div class="bg-white rounded-lg p-6 border border-gray-300">
              <h3 class="font-bold text-lg mb-4">Feedback by Source</h3>
              <div class="space-y-2">
                \${[
                  { name: 'GitHub', count: feedbackData.filter(f => f.source === 'GitHub').length },
                  { name: 'Discord', count: feedbackData.filter(f => f.source === 'Discord').length },
                  { name: 'Support', count: feedbackData.filter(f => f.source === 'Support Tickets').length },
                  { name: 'Twitter', count: feedbackData.filter(f => f.source === 'Twitter/X').length },
                  { name: 'Forum', count: feedbackData.filter(f => f.source === 'Community Forum').length },
                  { name: 'Email', count: feedbackData.filter(f => f.source === 'Email').length }
                ].map(item => \`
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-700">\${item.name}</span>
                    <div class="flex items-center gap-2">
                      <div class="w-24 h-2 bg-gray-200 rounded" style="background: linear-gradient(to right, #f97316 \${(item.count/2)*100}%, #e5e7eb 0%);"></div>
                      <span class="text-sm font-bold w-6 text-right">\${item.count}</span>
                    </div>
                  </div>
                \`).join('')}
              </div>
            </div>

            <!-- Sentiment Distribution -->
            <div class="bg-white rounded-lg p-6 border border-gray-300">
              <h3 class="font-bold text-lg mb-4">Sentiment Distribution</h3>
              <div class="flex flex-col items-center justify-center py-6">
                <div class="relative w-32 h-32 rounded-full flex items-center justify-center" style="background: conic-gradient(#ff4444 0deg 252deg, #ffaa00 252deg 360deg); box-shadow: inset 0 0 20px rgba(0,0,0,0.1);">
                  <div class="w-24 h-24 bg-white rounded-full flex items-center justify-center">
                    <div class="text-center text-xs">
                      <p class="font-bold">\${filtered.filter(f => f.sentiment === 'negative').length}</p>
                      <p class="text-gray-600">Negative</p>
                    </div>
                  </div>
                </div>
                <div class="mt-4 space-y-1 text-center text-sm">
                  <p><span class="text-red-500">●</span> Negative: \${filtered.filter(f => f.sentiment === 'negative').length}</p>
                  <p><span class="text-yellow-500">●</span> Neutral: \${filtered.filter(f => f.sentiment === 'neutral').length}</p>
                  <p><span class="text-green-500">●</span> Positive: \${filtered.filter(f => f.sentiment === 'positive').length}</p>
                </div>
              </div>
            </div>

            <!-- Urgency Breakdown -->
            <div class="bg-white rounded-lg p-6 border border-gray-300">
              <h3 class="font-bold text-lg mb-4">Urgency Breakdown</h3>
              <div class="space-y-3">
                \${[
                  { name: 'Critical', value: filtered.filter(f => f.urgency === 'critical').length, color: '#dc2626' },
                  { name: 'High', value: filtered.filter(f => f.urgency === 'high').length, color: '#ea580c' },
                  { name: 'Medium', value: filtered.filter(f => f.urgency === 'medium').length, color: '#f59e0b' }
                ].map(item => \`
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700">\${item.name}</span>
                    <div class="flex items-center gap-2">
                      <div class="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full" style="width: \${(item.value/4)*100}%; background-color: \${item.color};"></div>
                      </div>
                      <span class="text-sm font-bold w-4 text-right">\${item.value}</span>
                    </div>
                  </div>
                \`).join('')}
              </div>
            </div>

            <!-- Top Themes -->
            <div class="bg-white rounded-lg p-6 border border-gray-300">
              <h3 class="font-bold text-lg mb-4">Top Themes</h3>
              <div class="space-y-3">
                \${[
                  { name: 'Outage Impact', count: 4 },
                  { name: 'Performance Degradation', count: 3 },
                  { name: 'Data Integrity', count: 2 },
                  { name: 'Feature Unavailability', count: 2 }
                ].map(theme => \`
                  <div class="flex items-center justify-between">
                    <span class="text-gray-700">\${theme.name}</span>
                    <div class="flex items-center gap-2">
                      <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-orange-500" style="width: \${(theme.count / 4) * 100}%;"></div>
                      </div>
                      <span class="text-sm font-medium text-gray-600">\${theme.count}</span>
                    </div>
                  </div>
                \`).join('')}
              </div>
            </div>
          </div>
        \`;
      }

      if (activeTab === 'feedback') {
        html += \`
          <h2 class="text-2xl font-bold mb-6">All Feedback Items (\${filtered.length})</h2>
          <div class="space-y-4">
            \${filtered.map(item => \`
              <div class="bg-white rounded-lg p-6 border border-gray-300 hover:border-orange-300 transition">
                <div class="flex gap-2 mb-3">
                  <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-semibold">\${item.source}</span>
                  <span class="px-2 py-1 \${item.sentiment === 'negative' ? 'bg-red-100 text-red-700' : item.sentiment === 'neutral' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'} text-xs rounded font-semibold">\${item.sentiment}</span>
                  <span class="px-2 py-1 \${item.urgency === 'critical' ? 'bg-red-100 text-red-700' : item.urgency === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'} text-xs rounded font-semibold">\${item.urgency}</span>
                  <span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">\${item.region}</span>
                </div>
                <p class="font-semibold text-gray-900 mb-1">\${item.product}</p>
                <p class="text-gray-700 mb-2">\${item.content}</p>
                <p class="text-xs text-gray-500">Theme: \${item.theme} | \${new Date(item.timestamp).toLocaleString()}</p>
              </div>
            \`).join('')}
          </div>
        \`;
      }

      if (activeTab === 'analysis') {
        html += \`
          <div class="bg-white rounded-lg p-6 border border-gray-300">
            <h2 class="text-2xl font-bold mb-4">AI-Powered Analysis Report</h2>
            
            <div class="space-y-6">
              <div>
                <h3 class="font-bold text-lg mb-3">Key Findings</h3>
                <ul class="space-y-2 list-disc list-inside text-gray-700">
                  <li>Argo Smart Routing core functionality disabled during outage</li>
                  <li>Smart routing analytics offline for 2+ hours</li>
                  <li>Customer sites experienced 35-50% performance degradation</li>
                  <li>Global impact across 5 regions</li>
                </ul>
              </div>

              <div>
                <h3 class="font-bold text-lg mb-3">Recommendations</h3>
                <ol class="space-y-2 list-decimal list-inside text-gray-700">
                  <li>Create incident postmortem for Argo Smart Routing failover mechanism</li>
                  <li>Review configuration file size validation in bot management system</li>
                  <li>Implement circuit breaker for analytics pipeline</li>
                  <li>Add redundancy to smart routing decision engine</li>
                </ol>
              </div>

              <div>
                <h3 class="font-bold text-lg mb-3">Affected Regions</h3>
                <div class="flex gap-2 flex-wrap">
                  <span class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-semibold">Global</span>
                  <span class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-semibold">US-East</span>
                  <span class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-semibold">US-West</span>
                  <span class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-semibold">EU</span>
                  <span class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-semibold">APAC</span>
                </div>
              </div>
            </div>
          </div>
        \`;
      }

      if (activeTab === 'workflow') {
        html += \`
          <div class="bg-white rounded-lg p-6 border border-gray-300">
            <h2 class="text-2xl font-bold mb-4">Workflow Execution Log</h2>
            <div class="space-y-2 mb-6">
              \${[
                { time: '14:32', action: 'Feedback ingestion started', status: 'success' },
                { time: '14:33', action: 'AI sentiment analysis complete', status: 'success' },
                { time: '14:34', action: 'Theme clustering completed', status: 'success' },
                { time: '14:35', action: 'Severity assessment done', status: 'success' },
                { time: '14:36', action: 'Slack notification sent', status: 'success' },
                { time: '14:37', action: 'Report generated', status: 'success' }
              ].map(log => \`
                <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-300">
                  <div class="w-16 font-mono text-sm text-gray-600">\${log.time}</div>
                  <div class="flex-1">
                    <p class="text-gray-900 font-medium">\${log.action}</p>
                  </div>
                  <div class="px-3 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">\${log.status}</div>
                </div>
              \`).join('')}
            </div>
            <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p class="text-sm text-green-800">
                <span class="font-semibold">✓ Workflow Complete:</span> Feedback aggregated from 6 sources, analyzed with AI, and results ready for distribution.
              </p>
            </div>
          </div>
        \`;
      }

      if (activeTab === 'chat') {
        html += \`
          <div class="bg-white rounded-lg p-6 border border-gray-300 flex flex-col h-96">
            <h2 class="text-2xl font-bold mb-4">🤖 AI Chat Assistant</h2>
            <p class="text-gray-600 text-sm mb-4">Ask questions about the feedback, insights, or analysis using Workers AI (Llama 3)</p>
            
            <div id="chat-messages" class="flex-1 overflow-y-auto mb-4 p-3 bg-gray-50 rounded-lg border border-gray-300">
              \${chatMessages.length === 0 ? '<p class="text-gray-500 text-center py-8">Start a conversation...</p>' : ''}
            </div>

            <div class="flex gap-2">
              <input 
                id="chat-input" 
                type="text" 
                placeholder="Ask me about the feedback..." 
                class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500"
                onkeypress="if(event.key==='Enter') sendChatMessage(document.getElementById('chat-input').value)"
              />
              <button 
                onclick="sendChatMessage(document.getElementById('chat-input').value)"
                class="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
              >
                Send
              </button>
            </div>
          </div>
        \`;
      }

      html += \`
          </div>
        </div>
      \`;

      document.getElementById('app').innerHTML = html;
      if (activeTab === 'chat') renderChatTab();
    }

    function setTab(tab) {
      activeTab = tab;
      render();
    }

    function setProduct(product) {
      selectedProduct = product;
      render();
    }

    render();
  </script>
</body>
</html>`;