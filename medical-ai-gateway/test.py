from model.factory import embedding_model

try:
    # 测试生成 embedding
    result = embedding_model.embed_query("你好，世界")
    print(f"✅ Embedding 模型正常工作！")
    print(f"向量维度: {len(result)}")
    print(f"前5个值: {result[:5]}")
except Exception as e:
    print(f"❌ Embedding 模型初始化失败: {e}")

