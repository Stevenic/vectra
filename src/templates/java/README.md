# Vectra Java Client

Thin idiomatic Java wrapper over the Vectra gRPC service.

## Prerequisites

Add gRPC dependencies to your build tool.

### Gradle

```groovy
plugins {
    id 'com.google.protobuf' version '0.9.4'
}

dependencies {
    implementation 'io.grpc:grpc-netty-shaded:1.65.0'
    implementation 'io.grpc:grpc-protobuf:1.65.0'
    implementation 'io.grpc:grpc-stub:1.65.0'
    compileOnly 'javax.annotation:javax.annotation-api:1.3.2'
}

protobuf {
    protoc { artifact = 'com.google.protobuf:protoc:3.25.3' }
    plugins {
        grpc { artifact = 'io.grpc:protoc-gen-grpc-java:1.65.0' }
    }
    generateProtoTasks {
        all()*.plugins { grpc {} }
    }
}
```

### Maven

```xml
<dependencies>
    <dependency>
        <groupId>io.grpc</groupId>
        <artifactId>grpc-netty-shaded</artifactId>
        <version>1.65.0</version>
    </dependency>
    <dependency>
        <groupId>io.grpc</groupId>
        <artifactId>grpc-protobuf</artifactId>
        <version>1.65.0</version>
    </dependency>
    <dependency>
        <groupId>io.grpc</groupId>
        <artifactId>grpc-stub</artifactId>
        <version>1.65.0</version>
    </dependency>
</dependencies>
```

## Generate gRPC stubs

Place `vectra_service.proto` in `src/main/proto/`. With the Gradle protobuf plugin or Maven gRPC plugin, stubs are generated automatically at build time.

## Usage

```java
import io.github.vectra.client.VectraClient;

try (VectraClient client = new VectraClient()) {
    // Create a document index
    client.createIndex("my-index", "json", true, 512, 0);

    // Add a document
    client.upsertDocument("my-index", "doc1.txt", "Hello world...");

    // Query
    var results = client.queryDocuments("my-index", "hello");
    for (var doc : results) {
        System.out.printf("%s (score: %.3f)%n", doc.getUri(), doc.getScore());
        for (var chunk : doc.getChunksList()) {
            System.out.printf("  %s...%n", chunk.getText().substring(0, Math.min(80, chunk.getText().length())));
        }
    }
}
```
