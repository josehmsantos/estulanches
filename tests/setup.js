// Silencia os logs da aplicação durante os testes para deixar a saída legível.
process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
