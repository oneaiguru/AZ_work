# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

COPY gradlew ./
COPY gradle gradle
COPY scripts scripts
COPY build.gradle.kts settings.gradle.kts ./
COPY src src

RUN chmod +x gradlew scripts/prepare-wrapper.sh \
    && ./scripts/prepare-wrapper.sh --force \
    && ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /workspace/build/libs/graphql-service-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
