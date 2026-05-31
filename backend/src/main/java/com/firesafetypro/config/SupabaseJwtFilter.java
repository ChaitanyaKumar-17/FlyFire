package com.firesafetypro.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.Map;

@Component
public class SupabaseJwtFilter extends OncePerRequestFilter {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service-role-key}")
    private String apikey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            try {
                // Validate token by calling Supabase directly
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(supabaseUrl + "/auth/v1/user"))
                        .header("Authorization", "Bearer " + token)
                        .header("apikey", apikey)
                        .GET()
                        .build();

                HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

                if (res.statusCode() == 200) {
                    Map<String, Object> userData = objectMapper.readValue(res.body(), Map.class);
                    String userId = (String) userData.get("id");

                    // Create a dummy Jwt object just so our controllers can extract the "sub" claim
                    Jwt jwt = new Jwt(token, Instant.now(), Instant.now().plusSeconds(3600),
                            Map.of("alg", "HS256"), Map.of("sub", userId));

                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            jwt, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))
                    );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } else {
                    System.err.println("Supabase JWT Filter failed: " + res.body());
                }
            } catch (Exception e) {
                System.err.println("Supabase JWT Filter exception: " + e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }
}
