# Rules

1. 始终使用中文回复
2. 如果需要更新supabase，直接更新
3. 每一次修改都要在versions中添加版本记录
4. 控制台输出的日志内容，仅在开发环境中输出，确保生产环境不输出
5. 不要直接删除代码，将旧代码注释掉，并添加注释时的版本信息。比如当前版本1.2.4，则被注释的代码添加1.2.4。新增代码comment为1.2.5
6. json文件等无法注释的文件，复制创建backup文件，文件名为当前版本。如：当前版本1.2.4，则创建的backup文件名为1.2.4.【文件名】.json
7. 增加或者规划新的功能时，首先搜索github是否有开源的框架可用，不要自己造轮子
8. cursor创建的plan.md前缀改为创建的计划的标题
   - 创建Plan后，将创建的plan保存到Plan文件夹中，并且当plan有更新时，同步更新对应的文件。
9. 所有开发都要严格参考/Users/haya_ceo/Projects/YuiChat/docs/SAFE_EDIT_GUIDE.md开发规范
10. 本地环境的配置使用/Users/haya_ceo/Projects/YuiChat/.env.local
