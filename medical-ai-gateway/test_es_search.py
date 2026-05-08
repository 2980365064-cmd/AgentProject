# test_retrieval.py - 放在 medical-ai-gateway 目录下运行
from rag.vector_store import VectorStoreService

# 初始化向量服务
vector_service = VectorStoreService()
retriever = vector_service.get_retriever()

# 测试不同的查询
test_queries = [
    "袁子翔是谁",
    "袁子翔",
    "大傻叉",
    "测试文档",
]

print("=" * 60)
print("测试 RAG 检索效果")
print("=" * 60)

for query in test_queries:
    print(f"\n🔍 查询: '{query}'")
    docs = retriever.invoke(query, k=3)

    if docs:
        print(f"✅ 检索到 {len(docs)} 条结果:")
        for i, doc in enumerate(docs, 1):
            print(f"  [{i}] 分数: {doc.metadata.get('score', 'N/A'):.4f}")
            print(f"      内容: {doc.page_content[:100]}...")
            print(f"      来源: {doc.metadata.get('filename', 'Unknown')}")
    else:
        print("❌ 未检索到任何结果")

print("\n" + "=" * 60)
