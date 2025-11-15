package com.example.graphql.book;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record NewBookInput(
        @NotBlank String id,
        @NotBlank String title,
        @NotBlank String author,
        @NotNull @Positive Integer publishedYear
) {
}
