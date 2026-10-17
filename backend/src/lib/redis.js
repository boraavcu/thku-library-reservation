import Redis from 'ioredis';

const getRedisClient = () => {
  if (!global.redisClient) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    console.log("🔄 Redis'e bağlanılıyor... Hedef URL:", redisUrl);

    global.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3, // Bağlanamazsa sonsuza kadar beklemesin, hata fırlatsın
      retryStrategy(times) {
        if (times > 3) {
          console.error("🚨 Redis'e ulaşılamadı! Lütfen Docker konteynerini kontrol edin.");
          return null;
        }
        return Math.min(times * 50, 2000);
      }
    });

    global.redisClient.on('connect', () => {
      console.log('✅ Redis ile BAĞLANTI KURULDU!');
    });

    global.redisClient.on('error', (err) => {
      console.error('❌ Redis Bağlantı HATASI:', err.message);
    });
  }
  return global.redisClient;
};

const redis = getRedisClient();

export default redis;