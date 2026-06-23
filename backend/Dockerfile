FROM eclipse-temurin:21-jdk AS build

WORKDIR /workspace

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle

RUN chmod +x ./gradlew && ./gradlew dependencies --no-daemon

COPY src ./src
RUN ./gradlew bootJar --no-daemon \
    && JAR_FILE="$(find build/libs -maxdepth 1 -name '*.jar' ! -name '*-plain.jar' -print -quit)" \
    && cp "$JAR_FILE" /workspace/app.jar

FROM eclipse-temurin:21-jre

WORKDIR /app

ENV JAVA_OPTS=""

COPY --from=build /workspace/app.jar /app/app.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
