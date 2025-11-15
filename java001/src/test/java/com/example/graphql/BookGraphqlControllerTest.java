package com.example.graphql;

import com.example.graphql.book.Book;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.graphql.GraphQlTest;
import org.springframework.context.annotation.Import;
import org.springframework.graphql.test.tester.GraphQlTester;

import com.example.graphql.book.BookGraphqlController;
import com.example.graphql.book.BookService;

@GraphQlTest(BookGraphqlController.class)
@Import(BookService.class)
class BookGraphqlControllerTest {

    @Autowired
    private GraphQlTester graphQlTester;

    @Test
    @DisplayName("should fetch all books")
    void shouldFetchBooks() {
        graphQlTester.document("{ books { id title author publishedYear } }")
                .execute()
                .path("books").entityList(Book.class)
                .hasSizeGreaterThan(0);
    }

    @Test
    @DisplayName("should add a new book and fetch it by id")
    void shouldAddBook() {
        var mutation = "mutation { addBook(input: {id: \"3\", title: \"Domain-Driven Design\", author: \"Eric Evans\", publishedYear: 2003}) { id title } }";

        graphQlTester.document(mutation)
                .execute()
                .path("addBook.id").entity(String.class).isEqualTo("3");

        graphQlTester.document("{ bookById(id: \"3\") { title author publishedYear } }")
                .execute()
                .path("bookById.title").entity(String.class).isEqualTo("Domain-Driven Design");
    }
}
