package com.example.graphql.book;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class BookService {

    private final Map<String, Book> books = new ConcurrentHashMap<>();

    @PostConstruct
    void preload() {
        List.of(
                new Book("1", "Clean Architecture", "Robert C. Martin", 2017),
                new Book("2", "GraphQL in Action", "Samer Buna", 2021)
        ).forEach(book -> books.put(book.id(), book));
    }

    public Collection<Book> findAll() {
        return books.values();
    }

    public Optional<Book> findById(String id) {
        return Optional.ofNullable(books.get(id));
    }

    public Book addBook(NewBookInput input) {
        var identifier = input.id();
        if (books.containsKey(identifier)) {
            throw new IllegalArgumentException("Book with id %s already exists".formatted(identifier));
        }

        var book = new Book(
                identifier,
                input.title(),
                input.author(),
                input.publishedYear()
        );
        books.put(identifier, book);
        return book;
    }
}
