package com.example.graphql.book;

import jakarta.validation.Valid;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.Collection;
import java.util.Optional;

@Controller
public class BookGraphqlController {

    private final BookService bookService;

    public BookGraphqlController(BookService bookService) {
        this.bookService = bookService;
    }

    @QueryMapping
    public Collection<Book> books() {
        return bookService.findAll();
    }

    @QueryMapping
    public Optional<Book> bookById(@Argument String id) {
        return bookService.findById(id);
    }

    @MutationMapping
    public Book addBook(@Argument @Valid NewBookInput input) {
        return bookService.addBook(input);
    }
}
