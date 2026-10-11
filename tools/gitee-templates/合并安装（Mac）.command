#!/bin/bash
cd "$(dirname "$0")"
echo
echo " 泰语个人知识库 · APK 分片合并"
echo " ========================================"
echo
for i in {{seqList}}; do
  if [ ! -f "thai-kb.apk.part$i" ]; then
    echo " [错误] 找不到 thai-kb.apk.part$i"
    echo "        请把 {{parts}} 个 part 文件与本脚本放在同一个文件夹里再运行。"
    read -p "按回车关闭…"; exit 1
  fi
done
echo " 正在合并 {{parts}} 个分片 …"
cat {{catArgs}} > thai-kb.apk
ls -lh thai-kb.apk | awk '{print " 合并完成："$9"（"$5"）"}'
echo
echo " 正在校验…"
echo " 期望值： {{sha256}}"
shasum -a 256 thai-kb.apk
echo
echo " 上面那串与「期望值」一致 = 文件完好，可以传到手机安装。"
echo " 不一致 = 分片下载不完整，请删掉全部 part 重新下载。"
echo
read -p "按回车关闭…"
