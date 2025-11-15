# GraphQL Book Service

Простой демонстрационный сервис на Java 21 и Spring Boot 3.2, который предоставляет GraphQL-интерфейс для управления коллекцией книг.

## Стек

- Java 21
- Spring Boot 3.2 (Spring for GraphQL, Actuator)
- Gradle 8.6 (wrapper JAR хранится в Base64)

## Возможности

- GraphQL Query `books` — получить список всех книг.
- GraphQL Query `bookById` — получить книгу по идентификатору.
- GraphQL Mutation `addBook` — добавить новую книгу.
- Встроенный GraphiQL UI (доступен по адресу `http://localhost:8080/graphiql`).

## Структура GraphQL-схемы

```graphql
type Query {
  books: [Book!]!
  bookById(id: ID!): Book
}

type Mutation {
  addBook(input: NewBookInput!): Book!
}

type Book {
  id: ID!
  title: String!
  author: String!
  publishedYear: Int!
}

input NewBookInput {
  id: ID!
  title: String!
  author: String!
  publishedYear: Int!
}
```

## Подготовка Gradle Wrapper

В репозитории хранится только Base64-представление `gradle-wrapper.jar`. Перед запуском любых Gradle-команд восстановите файл:

```bash
./scripts/prepare-wrapper.sh
```

Скрипт повторно не скачивает артефакт, если он уже восстановлен. При необходимости можно удалить `gradle/wrapper/gradle-wrapper.jar` или запустить скрипт с флагом `--force`, чтобы принудительно восстановить файл.

## Запуск локально

```bash
./gradlew bootRun
```

Сервис будет доступен на `http://localhost:8080/graphql` (GraphQL endpoint) и `http://localhost:8080/graphiql` (UI для тестирования запросов).

## Примеры запросов

**Получить все книги:**

```graphql
query {
  books {
    id
    title
    author
    publishedYear
  }
}
```

**Добавить книгу и получить её по идентификатору:**

```graphql
mutation {
  addBook(
    input: {
      id: "3"
      title: "Domain-Driven Design"
      author: "Eric Evans"
      publishedYear: 2003
    }
  ) {
    id
    title
  }
}

query {
  bookById(id: "3") {
    title
    author
    publishedYear
  }
}
```

## Тестирование

```bash
./gradlew test
```

Тесты используют `GraphQlTester` и проверяют основные сценарии (получение списка книг и добавление новой книги).

## Сборка jar-файла

```bash
./gradlew bootJar
```

Собранный артефакт будет находиться в `build/libs/graphql-service-0.0.1-SNAPSHOT.jar`.

## Docker

### Сборка образа

```bash
docker build -t graphql-book-service .
```

### Запуск контейнера

```bash
docker run --rm -p 8080:8080 graphql-book-service
```

Сервис будет доступен на `http://localhost:8080`.

## CI/Automation

В проекте используется Gradle Wrapper, поэтому на CI можно выполнять команды:

```bash
./gradlew clean test
./gradlew bootJar
```

Docker-образ можно публиковать в любом registry при помощи стандартных команд `docker tag` / `docker push`.
