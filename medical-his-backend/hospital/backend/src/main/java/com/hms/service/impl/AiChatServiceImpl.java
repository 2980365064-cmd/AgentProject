package com.hms.service.impl;

import com.hms.dto.AiSessionDTO;
import com.hms.dto.AiMessageDTO;
import com.hms.dto.request.AiChatRequest;
import com.hms.dto.request.AiSessionCreateRequest;
import com.hms.dto.response.AiChatResponse;
import com.hms.entity.Doctor;
import com.hms.entity.Patient;
import com.hms.service.AiChatService;
import com.hms.service.DoctorService;
import com.hms.service.PatientService;
import com.hms.util.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.ConnectException;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.Callable;

@Service
public class AiChatServiceImpl implements AiChatService {

    private static final Logger log = LoggerFactory.getLogger(AiChatServiceImpl.class);

    /** 网关超时/重试耗尽后返回给前端的统一提示 */
    public static final String AI_GATEWAY_UNAVAILABLE = "当前AI服务暂不可用";

    @Autowired
    private PatientService patientService;
    @Autowired
    private DoctorService doctorService;
    /**
     * 与前端助手形态对应，供 FastAPI / LangGraph 侧按档案切换工具集合。
     * health：患者「健康小助手」；management：医护「管理小助手」
     */
    public static final String ASSISTANT_PROFILE_HEALTH = "health";
    public static final String ASSISTANT_PROFILE_MANAGEMENT = "management";

    @Value("${ai.fastapi.url:http://localhost:8000}")
    private String fastApiUrl;

    @Autowired
    @Qualifier("aiGatewayRestTemplate")
    private RestTemplate aiGatewayRestTemplate;

    @Value("${ai.gateway.max-retries:3}")
    private int aiGatewayMaxRetries;

    @Value("${ai.gateway.total-timeout-ms:30000}")
    private int aiGatewayTotalTimeoutMs;

    @Value("${ai.gateway.retry-backoff-ms:400}")
    private long aiGatewayRetryBackoffMs;

    /** 由登录角色决定助手档案（以服务端 JWT 为准，防止前端伪造） */
    static String assistantProfileForRole(String userRole) {
        if (userRole == null || userRole.isBlank()) {
            return ASSISTANT_PROFILE_MANAGEMENT;
        }
        if ("PATIENT".equalsIgnoreCase(userRole.trim())) {
            return ASSISTANT_PROFILE_HEALTH;
        }
        return ASSISTANT_PROFILE_MANAGEMENT;
    }

    @Override
    public Response<?> sendMessage(Integer userId, String userRole, AiChatRequest request) {
        try {
            String url = fastApiUrl + "/api/v1/chat/messages";
            
            log.info("=== 开始调用Python FastAPI ===");
            log.info("URL: {}", url);
            log.info("用户ID: {}, 角色: {}", userId, userRole);
            log.info("用户消息: {}", request.getMessage());
            log.info("会话ID: {}", request.getSessionId());
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("user_input", request.getMessage());
            requestBody.put("user_id", userId);
            requestBody.put("user_role", userRole);
            requestBody.put("assistant_profile", assistantProfileForRole(userRole));

            if (request.getSessionId() != null && !request.getSessionId().isEmpty()) {
                requestBody.put("session_id", request.getSessionId());
                log.info("使用现有会话: {}", request.getSessionId());
            } else {
                requestBody.put("session_id", "");
                log.info("创建新会话（session_id为空字符串）");
            }
            if (request.getBearerToken() != null && !request.getBearerToken().isBlank()) {
                requestBody.put("bearer_token", request.getBearerToken());
            }

            log.info("发送给Python的请求Body: {}", requestBody);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<Map> response = executeWithRetry("AI聊天", () ->
                    aiGatewayRestTemplate.postForEntity(url, entity, Map.class));
            
            log.info("Python响应状态码: {}", response.getStatusCode());
            
            if (response.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> body = response.getBody();
                log.info("Python完整响应: {}", body);

                int code = -1;
                Object codeObj = body != null ? body.get("code") : null;
                if (codeObj instanceof Number) {
                    code = ((Number) codeObj).intValue();
                }
                if (code == 200) {
                    Map<String, Object> data = (Map<String, Object>) body.get("data");
                    if (data != null) {
                        String aiMessage = (String) data.get("response");
                        String sessionId = (String) data.get("session_id");
                        
                        log.info("✓ AI回复成功");
                        log.info("  - AI消息: {}", aiMessage);
                        log.info("  - 会话ID: {}", sessionId);
                        
                        AiChatResponse aiResponse = AiChatResponse.builder()
                                .aiMessage(aiMessage)
                                .sessionId(sessionId)
                                .timestamp(System.currentTimeMillis())
                                .build();
                        return new Response<>("success", "AI回复成功", aiResponse);
                    } else {
                        log.error("✗ Python返回的data字段为空");
                        return new Response<>("error", "AI服务返回数据格式错误", null);
                    }
                } else {
                    log.error("✗ Python返回错误码: {}, 消息: {}", code, body.get("message"));
                    return new Response<>("error", "AI服务调用失败: " + body.get("message"), null);
                }
            } else {
                log.error("✗ HTTP请求失败，状态码: {}", response.getStatusCode());
                return new Response<>("error", "AI服务调用失败", null);
            }
        } catch (Exception e) {
            log.error("✗ 调用AI服务异常", e);
            if (isAiGatewayFailure(e)) {
                return new Response<>("error", AI_GATEWAY_UNAVAILABLE, null);
            }
            return new Response<>("error", "AI服务异常: " + e.getMessage(), null);
        }
    }



    @Override
    public Response<?> getSessionList(Integer userId, String userRole) {
        try {
            String assistantProfile = assistantProfileForRole(userRole);

            String url = UriComponentsBuilder.fromUriString(fastApiUrl + "/api/v1/sessions")
                    .queryParam("user_id", userId)
                    .queryParam("user_role", userRole)
                    .queryParam("assistant_profile", assistantProfile)  // ✅ 添加 assistant_profile 参数
                    .build()
                    .toUriString();

            log.info("获取会话列表URL: {}", url);
            log.info("用户ID: {}, 角色: {}, 助手档案: {}", userId, userRole, assistantProfile);

            HttpEntity<Void> entity = new HttpEntity<>(new HttpHeaders());
            ResponseEntity<Map> response = executeWithRetry("AI会话列表", () ->
                    aiGatewayRestTemplate.exchange(url, HttpMethod.GET, entity, Map.class));
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                
                if (pythonApiCode(body) == 200) {
                    List<AiSessionDTO> sessions = new ArrayList<>();
                    Object dataObj = body.get("data");
                    
                    if (dataObj instanceof Map) {
                        Map<String, Object> dataMap = (Map<String, Object>) dataObj;
                        Object sessionsList = dataMap.get("sessions");
                        if (sessionsList instanceof List) {
                            parseSessionList((List<?>) sessionsList, sessions);
                        }
                    }
                    
                    log.info("✓ 获取会话列表成功，共 {} 个会话", sessions.size());
                    return new Response<>("success", "获取会话列表成功", sessions);
                } else {
                    String errorMsg = (String) body.get("message");
                    log.error("✗ Python服务返回错误: {}", errorMsg);
                    return new Response<>("error", "Python服务错误: " + errorMsg, new ArrayList<>());
                }
            }
            log.warn("⚠ Python服务无响应，返回空列表");
            return new Response<>("success", "获取会话列表成功", new ArrayList<>());
        } catch (Exception e) {
            log.error("✗ 获取会话列表异常，返回空列表以避免前端崩溃", e);
            return new Response<>("success", "获取会话列表成功", new ArrayList<>());
        }
    }

    @Override
    public Response<?> getSessionHistory(String sessionId, Integer userId, String userRole) {
        if (sessionId == null || "undefined".equals(sessionId)) {
            return new Response<>("error", "无效的会话 ID", null);
        }

        try {
            String assistantProfile = assistantProfileForRole(userRole);

            String url = UriComponentsBuilder.fromUriString(fastApiUrl + "/api/v1/sessions/{sessionId}/history")
                    .queryParam("user_id", userId)
                    .queryParam("user_role", userRole)
                    .queryParam("assistant_profile", assistantProfile)  // ✅ 添加 assistant_profile 参数
                    .buildAndExpand(sessionId)
                    .toUriString();

            log.info("获取会话历史URL: {}", url);
            log.info("用户ID: {}, 角色: {}, 助手档案: {}, 会话ID: {}", userId, userRole, assistantProfile, sessionId);

            HttpEntity<Void> entity = new HttpEntity<>(new HttpHeaders());
            ResponseEntity<Map> response = executeWithRetry("AI会话历史", () ->
                    aiGatewayRestTemplate.exchange(url, HttpMethod.GET, entity, Map.class));
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                
                if (pythonApiCode(body) == 200) {
                    List<AiMessageDTO> messages = new ArrayList<>();
                    Object dataObj = body.get("data");
                    
                    // FastAPI SessionHistoryData 为 { "messages": [...] }；兼容 history 或顶层数组
                    if (dataObj instanceof List) {
                        parseMessageList((List<?>) dataObj, messages);
                    } else if (dataObj instanceof Map) {
                        Map<?, ?> dataMap = (Map<?, ?>) dataObj;
                        Object list = dataMap.get("messages");
                        if (list == null) {
                            list = dataMap.get("history");
                        }
                        parseMessageList((List<?>) list, messages);
                    }
                    
                    return new Response<>("success", "获取历史成功", messages);
                }
            }
            return new Response<>("error", "获取历史记录失败", null);
        } catch (Exception e) {
            log.error("✗ 获取会话历史异常", e);
            if (isAiGatewayFailure(e)) {
                return new Response<>("error", AI_GATEWAY_UNAVAILABLE, null);
            }
            return new Response<>("error", "系统异常: " + e.getMessage(), null);
        }
    }

    @Override
    public Response<?> deleteSession(Integer userId, String userRole, String sessionId) {
        try {
            // ✅ 修复：FastAPI 的删除接口不需要 user_id 和 user_role 参数
            String url = String.format("%s/api/v1/sessions/%s",
                    fastApiUrl, sessionId);

            log.info("删除会话URL: {}", url);
            log.info("删除会话ID: {}", sessionId);

            HttpHeaders headers = new HttpHeaders();
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            
            ResponseEntity<Map> response = executeWithRetry("AI删除会话", () ->
                    aiGatewayRestTemplate.exchange(url, HttpMethod.DELETE, entity, Map.class));
            
            if (response.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> body = response.getBody();
                if (body != null) {
                    int code = pythonApiCode(body);
                    String message = (String) body.get("message");

                    if (code == 200) {
                        log.info("✓ 会话删除成功: {}", sessionId);
                        return new Response<>("success", message != null ? message : "会话删除成功", null);
                    } else {
                        log.error("✗ 删除会话失败: {}", message);
                        return new Response<>("error", message, null);
                    }
                }
                log.info("✓ 会话删除成功");
                return new Response<>("success", "会话删除成功", null);
            } else {
                log.error("✗ 删除会话失败，状态码: {}", response.getStatusCode());
                return new Response<>("error", "删除会话失败", null);
            }
        } catch (Exception e) {
            log.error("✗ 删除会话异常", e);
            if (isAiGatewayFailure(e)) {
                return new Response<>("error", AI_GATEWAY_UNAVAILABLE, null);
            }
            return new Response<>("error", "删除会话异常: " + e.getMessage(), null);
        }
    }

    @Override
    public Response<?> createNewSession(Integer userId, String userRole, AiSessionCreateRequest createRequest) {
        try {
            String url = fastApiUrl + "/api/v1/sessions";

            log.info("创建会话URL: {}", url);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("user_id", userId);
            requestBody.put("user_role", userRole);
            requestBody.put("assistant_profile", assistantProfileForRole(userRole));
            if (createRequest != null) {
                String title = createRequest.resolveTitle();
                if (title != null && !title.isEmpty()) {
                    requestBody.put("user_input", title.length() > 50 ? title.substring(0, 50) : title);
                }
            }

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = executeWithRetry("AI创建会话", () ->
                    aiGatewayRestTemplate.exchange(url, HttpMethod.POST, entity, Map.class));
            
            if (response.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> body = response.getBody();

                if (body == null) {
                    return new Response<>("error", "返回数据为空", null);
                }

                int code = pythonApiCode(body);
                String message = (String) body.get("message");

                if (code == 200 || code == 201) {
                    Map<String, Object> data = (Map<String, Object>) body.get("data");

                    if (data == null) {
                        return new Response<>("error", "数据格式错误", null);
                    }

                    // FastAPI 返回 id；兼容 session_id
                    String sessionId = (String) data.get("id");
                    if (sessionId == null || sessionId.isEmpty()) {
                        sessionId = (String) data.get("session_id");
                    }
                    if (sessionId != null) {
                        data.put("id", sessionId);
                        data.put("session_id", sessionId);
                    }

                    log.info("✓ 创建会话成功: {}", data);
                    return new Response<>("success", message != null ? message : "创建会话成功", data);
                } else {
                    log.error("✗ 创建会话失败: {}", message);
                    return new Response<>("error", message, null);
                }
            } else {
                log.error("✗ 创建会话失败，状态码: {}", response.getStatusCode());
                return new Response<>("error", "创建会话失败", null);
            }
        } catch (Exception e) {
            log.error("✗ 创建会话异常", e);
            if (isAiGatewayFailure(e)) {
                return new Response<>("error", AI_GATEWAY_UNAVAILABLE, null);
            }
            return new Response<>("error", "创建会话异常: " + e.getMessage(), null);
        }
    }

    /**
     * 辅助方法：解析会话列表 (适配新字段名 id)
     */
    private void parseSessionList(List<?> dataList, List<AiSessionDTO> targetList) {
        if (dataList == null) return;
        for (Object item : dataList) {
            if (item instanceof Map) {
                Map<String, Object> map = (Map<String, Object>) item;
                // ✅ 修复：FastAPI 返回的字段是 id，不是 session_id
                String sessionId = (String) map.get("id");

                // 兼容旧格式：如果 id 为空，尝试获取 session_id
                if (sessionId == null || sessionId.isEmpty()) {
                    sessionId = (String) map.get("session_id");
                }

                targetList.add(AiSessionDTO.builder()
                        .id(sessionId)
                        .title((String) map.getOrDefault("title", "新会话"))
                        .createdAt(map.get("createdAt") != null ? ((Number) map.get("createdAt")).longValue() : System.currentTimeMillis())
                        .lastUpdatedAt(map.get("updatedAt") != null ? ((Number) map.get("updatedAt")).longValue() : System.currentTimeMillis())
                        .messageCount(map.get("messageCount") != null ? ((Number) map.get("messageCount")).intValue() : 0)
                        .build());
            }
        }
    }

    /**
     * 辅助方法：解析消息列表
     */
    private void parseMessageList(List<?> dataList, List<AiMessageDTO> targetList) {
        if (dataList == null) return;
        for (Object item : dataList) {
            if (item instanceof Map) {
                Map<String, Object> map = (Map<String, Object>) item;
                targetList.add(AiMessageDTO.builder()
                        .role((String) map.get("role"))
                        .content((String) map.get("content"))
                        .timestamp(map.get("timestamp") != null ? ((Number) map.get("timestamp")).longValue() : System.currentTimeMillis())
                        .build());
            }
        }
    }

    /**
     * POST 流式 SSE；禁止自动跟随重定向，以免 301/302 被改成 GET 导致请求体丢失（FastAPI 会报 body Field required）。
     */
    private java.net.http.HttpResponse<java.util.stream.Stream<String>> postChatStreamSse(
            java.net.http.HttpClient httpClient,
            java.net.URI uri,
            byte[] jsonUtf8) throws java.io.IOException, InterruptedException {
        java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                .uri(uri)
                .timeout(Duration.ofMinutes(5))
                .header("Content-Type", "application/json; charset=UTF-8")
                .header("Accept", "text/event-stream")
                .POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(jsonUtf8))
                .build();
        return httpClient.send(req, java.net.http.HttpResponse.BodyHandlers.ofLines());
    }

    @Override
    public Response<?> sendMessageStream(Integer userId, String userRole, AiChatRequest request, java.util.function.Consumer<String> chunkCallback) {
        try {
            String url = fastApiUrl + "/api/v1/chat/stream";
            
            log.info("=== 开始调用Python FastAPI 流式接口 ===");
            log.info("URL: {}", url);
            log.info("用户ID: {}, 角色: {}", userId, userRole);
            log.info("用户消息: {}", request.getMessage());
            log.info("会话ID: {}", request.getSessionId());
            
            // 构建请求体
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("user_input", request.getMessage());
            requestBody.put("user_id", userId);
            requestBody.put("user_role", userRole);
            requestBody.put("assistant_profile", assistantProfileForRole(userRole));

            if (request.getSessionId() != null && !request.getSessionId().isEmpty()) {
                requestBody.put("session_id", request.getSessionId());
                log.info("使用现有会话: {}", request.getSessionId());
            } else {
                requestBody.put("session_id", "");
                log.info("创建新会话（session_id为空字符串）");
            }
            if (request.getBearerToken() != null && !request.getBearerToken().isBlank()) {
                requestBody.put("bearer_token", request.getBearerToken());
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", "text/event-stream");
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            
            // 使用 StreamingRestTemplate 或手动处理 SSE
            StringBuilder fullResponse = new StringBuilder();
            String sessionId = "";
            
            // ✅ 方案：使用 RestTemplate 执行流式请求
            // 注意：Spring 的 RestTemplate 不直接支持 SSE，需要使用其他方式
            
            com.fasterxml.jackson.databind.ObjectMapper streamMapper =
                    new com.fasterxml.jackson.databind.ObjectMapper();
            streamMapper.configure(com.fasterxml.jackson.core.JsonGenerator.Feature.ESCAPE_NON_ASCII, false);
            String jsonBody = streamMapper.writeValueAsString(requestBody);
            byte[] jsonBytes = jsonBody.getBytes(StandardCharsets.UTF_8);

            java.net.http.HttpClient httpClient = java.net.http.HttpClient.newBuilder()
                    .version(java.net.http.HttpClient.Version.HTTP_1_1)
                    .followRedirects(java.net.http.HttpClient.Redirect.NEVER)
                    .build();

            java.net.URI uri = java.net.URI.create(url);
            java.net.http.HttpResponse<java.util.stream.Stream<String>> response = null;
            long streamDeadline = System.currentTimeMillis() + aiGatewayTotalTimeoutMs;
            Exception lastStreamEx = null;
            for (int streamAttempt = 0; streamAttempt <= aiGatewayMaxRetries; streamAttempt++) {
                if (System.currentTimeMillis() >= streamDeadline) {
                    break;
                }
                try {
                    response = postChatStreamSse(httpClient, uri, jsonBytes);
                    break;
                } catch (Exception ex) {
                    lastStreamEx = ex;
                    if (!isStreamConnectRetryable(ex) || streamAttempt >= aiGatewayMaxRetries) {
                        throw ex;
                    }
                    log.warn("AI流式连接第 {} 次失败，将重试: {}", streamAttempt + 1, ex.getMessage());
                    long remain = streamDeadline - System.currentTimeMillis();
                    if (remain <= 0) {
                        break;
                    }
                    try {
                        Thread.sleep(Math.min(aiGatewayRetryBackoffMs * (streamAttempt + 1), Math.max(remain / 2, 1)));
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return new Response<>("error", AI_GATEWAY_UNAVAILABLE, null);
                    }
                }
            }
            if (response == null) {
                log.error("✗ AI流式连接在 {}ms 内重试耗尽", aiGatewayTotalTimeoutMs, lastStreamEx);
                return new Response<>("error", AI_GATEWAY_UNAVAILABLE, null);
            }

            int status = response.statusCode();
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                String location = response.headers().firstValue("Location").orElse(null);
                try (java.util.stream.Stream<String> drain = response.body()) {
                    drain.forEach(line -> { });
                }
                if (location != null && !location.isBlank()) {
                    java.net.URI next = uri.resolve(location);
                    log.warn("流式接口返回 {}，Location: {}，使用原 POST 正文重试（避免自动重定向丢 body）", status, next);
                    response = postChatStreamSse(httpClient, next, jsonBytes);
                    status = response.statusCode();
                }
            }

            if (status == 200) {
                java.util.stream.Stream<String> lines = response.body();
                Iterator<String> lineIterator = lines.iterator();
                
                while (lineIterator.hasNext()) {
                    String line = lineIterator.next().trim();
                    
                    if (line.startsWith("data: ")) {
                        String data = line.substring(6); // 去掉 "data: " 前缀
                        
                        if ("[DONE]".equals(data)) {
                            log.info("✓ SSE 流式传输完成");
                            break;
                        }
                        
                        // 解析 JSON 数据
                        try {
                            com.fasterxml.jackson.databind.JsonNode jsonNode = 
                                new com.fasterxml.jackson.databind.ObjectMapper().readTree(data);
                            
                            // Python 流式接口使用 content；兼容 chunk
                            String chunk = "";
                            if (jsonNode.has("chunk") && !jsonNode.get("chunk").isNull()) {
                                chunk = jsonNode.get("chunk").asText("");
                            } else if (jsonNode.has("content") && !jsonNode.get("content").isNull()) {
                                chunk = jsonNode.get("content").asText("");
                            }
                            if (jsonNode.has("error")) {
                                log.error("✗ Python SSE 返回错误: {}", jsonNode.get("error").asText());
                                break;
                            }
                            String currentSessionId = jsonNode.has("session_id") && !jsonNode.get("session_id").isNull()
                                    ? jsonNode.get("session_id").asText("") : "";
                            
                            if (!currentSessionId.isEmpty()) {
                                sessionId = currentSessionId;
                            }
                            
                            fullResponse.append(chunk);
                            
                            // ✅ 调用回调函数发送片段
                            if (chunkCallback != null && !chunk.isEmpty()) {
                                chunkCallback.accept(chunk);
                            }
                            
                        } catch (Exception e) {
                            log.warn("解析 SSE 数据失败: {}", e.getMessage());
                        }
                    }
                }
                
                // 构建最终响应
                AiChatResponse aiResponse = AiChatResponse.builder()
                        .aiMessage(fullResponse.toString())
                        .sessionId(sessionId)
                        .timestamp(System.currentTimeMillis())
                        .build();
                
                log.info("✓ 流式AI回复成功，共 {} 个字符", fullResponse.length());
                return new Response<>("success", "AI回复成功", aiResponse);
                
            } else {
                String errBody = "";
                try {
                    errBody = response.body() != null
                            ? String.join("\n", response.body().toList())
                            : "";
                } catch (Exception ignored) {
                    // ignore
                }
                log.error("✗ HTTP请求失败，状态码: {}，响应体: {}", status,
                        errBody.length() > 800 ? errBody.substring(0, 800) + "…" : errBody);
                return new Response<>("error", "AI服务调用失败（HTTP " + status + "）", null);
            }
            
        } catch (Exception e) {
            log.error("✗ 调用AI流式服务异常", e);
            if (isAiGatewayFailure(e)) {
                return new Response<>("error", AI_GATEWAY_UNAVAILABLE, null);
            }
            return new Response<>("error", "AI服务异常: " + e.getMessage(), null);
        }
    }

    @Override
    public Response<?> searchD(String name) {
        //从 数据库中获取医生信息
        List<Doctor> doctorList = doctorService.findByName(name);
        return new Response<>("success", "查询成功", doctorList);
    }

    @Override
    public Response<?> searchP(String name) {
        //从 数据库中获取患者信息
        List<Patient> patientList = patientService.findByName(name);
        return new Response<>("success", "查询成功", patientList);
    }


    /**
     * 调用 AI 网关：超时/连接失败/502–504 时最多重试 {@link #aiGatewayMaxRetries} 次，
     * 全程不超过 {@link #aiGatewayTotalTimeoutMs} 毫秒。
     */
    private <T> T executeWithRetry(String label, Callable<T> callable) throws Exception {
        long deadline = System.currentTimeMillis() + aiGatewayTotalTimeoutMs;
        Exception last = null;
        for (int attempt = 0; attempt <= aiGatewayMaxRetries; attempt++) {
            if (System.currentTimeMillis() >= deadline) {
                log.warn("{} 已达总超时 {}ms，停止重试", label, aiGatewayTotalTimeoutMs);
                break;
            }
            try {
                return callable.call();
            } catch (Exception ex) {
                last = ex;
                if (!isRetryable(ex) || attempt >= aiGatewayMaxRetries) {
                    throw ex;
                }
                log.warn("{} 第 {} 次调用失败，将重试（最多 {} 次重试）: {}", label, attempt + 1, aiGatewayMaxRetries, ex.toString());
                long remain = deadline - System.currentTimeMillis();
                if (remain <= 0) {
                    break;
                }
                long sleep = aiGatewayRetryBackoffMs * (attempt + 1);
                try {
                    Thread.sleep(Math.min(sleep, Math.max(remain / 2, 1)));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new ResourceAccessException("Interrupted while waiting to retry AI gateway",
                            new java.io.IOException(ie));
                }
            }
        }
        if (last != null) {
            throw last;
        }
        throw new ResourceAccessException("AI gateway call exhausted without result",
                new java.io.IOException("no successful response"));
    }

    private static boolean isRetryable(Throwable ex) {
        if (ex instanceof ResourceAccessException) {
            return true;
        }
        if (ex instanceof HttpServerErrorException hsee) {
            int code = hsee.getStatusCode().value();
            return code == 502 || code == 503 || code == 504;
        }
        Throwable c = ex.getCause();
        if (c != null && c != ex) {
            return isRetryable(c);
        }
        return false;
    }

    private static boolean isStreamConnectRetryable(Throwable ex) {
        if (ex instanceof HttpTimeoutException) {
            return true;
        }
        if (ex instanceof ConnectException) {
            return true;
        }
        if (ex instanceof java.io.IOException) {
            String m = ex.getMessage() != null ? ex.getMessage().toLowerCase(Locale.ROOT) : "";
            return m.contains("timed out") || m.contains("timeout") || m.contains("connection reset")
                    || m.contains("connection refused");
        }
        Throwable c = ex.getCause();
        if (c != null && c != ex) {
            return isStreamConnectRetryable(c);
        }
        return false;
    }

    private static boolean isAiGatewayFailure(Throwable ex) {
        if (ex instanceof ResourceAccessException) {
            return true;
        }
        if (ex instanceof HttpServerErrorException) {
            return true;
        }
        if (ex instanceof ConnectException) {
            return true;
        }
        if (ex instanceof HttpTimeoutException) {
            return true;
        }
        String msg = ex.getMessage();
        if (msg != null) {
            String m = msg.toLowerCase(Locale.ROOT);
            if (m.contains("timed out") || m.contains("timeout") || m.contains("connection refused")
                    || m.contains("connection reset")) {
                return true;
            }
        }
        Throwable c = ex.getCause();
        if (c != null && c != ex) {
            return isAiGatewayFailure(c);
        }
        return false;
    }

    /** FastAPI 的 code 在 JSON 中常为 Integer，部分序列化场景为 Long */
    private static int pythonApiCode(Map<String, Object> body) {
        if (body == null) {
            return -1;
        }
        Object c = body.get("code");
        if (c instanceof Number) {
            return ((Number) c).intValue();
        }
        return -1;
    }
}
