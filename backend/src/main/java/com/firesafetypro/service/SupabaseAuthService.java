package com.firesafetypro.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Service
public class SupabaseAuthService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service-role-key}")
    private String serviceRoleKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    
    private final ObjectMapper objectMapper = new ObjectMapper();

    public String createAuthUser(String email, String password, String fullName, String role) throws Exception {
        String endpoint = supabaseUrl + "/auth/v1/admin/users";

        Map<String, Object> payload = Map.of(
                "email", email,
                "password", password,
                "email_confirm", true,
                "user_metadata", Map.of(
                        "full_name", fullName,
                        "role", role
                )
        );

        String jsonPayload = objectMapper.writeValueAsString(payload);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Authorization", "Bearer " + serviceRoleKey)
                .header("apikey", serviceRoleKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400) {
            throw new RuntimeException("Failed to create Supabase Auth User: " + response.body());
        }

        // Parse response to get the UUID
        @SuppressWarnings("unchecked")
        Map<String, Object> responseMap = objectMapper.readValue(response.body(), Map.class);
        return (String) responseMap.get("id");
    }

    public void deleteAuthUser(String userId) throws Exception {
        String endpoint = supabaseUrl + "/auth/v1/admin/users/" + userId;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Authorization", "Bearer " + serviceRoleKey)
                .header("apikey", serviceRoleKey)
                .DELETE()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400 && response.statusCode() != 404) {
            throw new RuntimeException("Failed to delete Supabase Auth User: " + response.body());
        }
    }
}
