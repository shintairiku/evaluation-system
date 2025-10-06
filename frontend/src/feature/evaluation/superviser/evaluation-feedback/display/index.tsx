"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, ClipboardList } from "lucide-react";

// ダミーデータ（複数部下）
const dummyEmployees = [
  {
    id: "emp1",
    name: "山田 太郎",
    department: "営業部",
    position: "主任",
    avatar: null,
    goals: [
      {
        id: 1,
        type: "quantitative",
        label: "売上目標達成",
        selfScore: 90,
        selfComment: "売上を大きく伸ばせました。",
        supervisorComment: ""
      },
      {
        id: 2,
        type: "qualitative",
        label: "顧客満足度向上",
        selfScore: 80,
        selfComment: "顧客対応を丁寧に心がけました。",
        supervisorComment: ""
      }
    ],
    competency: {
      name: "チームワーク・協調性",
      selfScore: 85,
      selfComment: "チーム内での連携を意識しました。",
      supervisorComment: ""
    },
    coreValue: {
      selfComment: "会社のコアバリューを意識して行動しました。",
      supervisorComment: ""
    }
  },
  {
    id: "emp2",
    name: "佐藤 花子",
    department: "企画部",
    position: "一般",
    avatar: null,
    goals: [
      {
        id: 1,
        type: "quantitative",
        label: "新規案件獲得数",
        selfScore: 75,
        selfComment: "新規案件を3件獲得できました。",
        supervisorComment: ""
      }
    ],
    competency: {
      name: "主体性",
      selfScore: 80,
      selfComment: "自ら提案し行動しました。",
      supervisorComment: ""
    },
    coreValue: {
      selfComment: "コアバリューを意識して業務に取り組みました。",
      supervisorComment: ""
    }
  }
];

type SupervisorInputs = Record<
  string,
  {
    goals: string[];
    competency: string;
    coreValue: string;
  }
>;

export default function EvaluationFeedback() {
  const [selectedEmpId, setSelectedEmpId] = useState<string>(dummyEmployees[0].id);
  const [supervisorInputs, setSupervisorInputs] = useState<SupervisorInputs>(() => {
    const obj: SupervisorInputs = {};
    dummyEmployees.forEach(emp => {
      obj[emp.id] = {
        goals: emp.goals.map(() => ""),
        competency: "",
        coreValue: ""
      };
    });
    return obj;
  });

  const selectedEmp = dummyEmployees.find(e => e.id === selectedEmpId);
  // Suppress unused variable warning - selectedEmp is used for debugging/future implementation
  void selectedEmp;

  // 入力ハンドラ
  const handleSupervisorInput = (
    field: "goals" | "competency" | "coreValue",
    idx: number | null,
    value: string
  ) => {
    setSupervisorInputs(prev => ({
      ...prev,
      [selectedEmpId]: {
        ...prev[selectedEmpId],
        [field]: field === "goals" && typeof idx === "number"
          ? prev[selectedEmpId].goals.map((v: string, i: number) => i === idx ? value : v)
          : value
      }
    }));
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card className="shadow-xl border-0 bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 text-blue-700">
              <User className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">評価フィードバック</CardTitle>
              <p className="text-xs text-gray-500 mt-1">上司による評価入力</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-2">
          {/* 部下タブ */}
          <Tabs value={selectedEmpId} onValueChange={setSelectedEmpId}>
            <TabsList className="mb-6">
              {dummyEmployees.map(emp => (
                <TabsTrigger key={emp.id} value={emp.id} className="px-4 py-2">
                  {emp.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {dummyEmployees.map(emp => (
              <TabsContent key={emp.id} value={emp.id} className="space-y-8">
                {/* 被評価者情報 */}
                <div className="flex items-center gap-4 mb-2">
                  <div className="rounded-full bg-gray-200 w-14 h-14 flex items-center justify-center text-gray-500 text-2xl">
                    {emp.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={emp.avatar} alt="avatar" className="rounded-full w-14 h-14" />
                    ) : (
                      emp.name[0]
                    )}
                  </div>
                  <div>
                    <div className="text-lg font-bold">{emp.name}</div>
                    <div className="text-xs text-gray-500">{emp.position} / {emp.department}</div>
                  </div>
                </div>
                {/* 業績目標評価 */}
                {emp.goals.map((goal, idx) => (
                  <Card key={goal.id} className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5">
                    <div className="mb-2 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-blue-500" />
                      <span className="font-semibold text-blue-700">{goal.label}</span>
                      <Badge className={goal.type === "quantitative"
                        ? "bg-blue-600 text-white"
                        : "bg-purple-600 text-white"
                      }>
                        {goal.type === "quantitative" ? "定量" : "定性"}
                      </Badge>
                    </div>
                    {/* チャット風レイアウト */}
                    <div className="flex flex-col gap-4">
                      {/* 部下の自己評価（右寄せ） */}
                      <div className="flex justify-end">
                        <div className="bg-blue-100 text-blue-900 rounded-xl px-5 py-3 w-[80%] shadow">
                          <div className="text-xs text-gray-500 mb-1">自己評価スコア</div>
                          <div className="font-bold text-lg mb-1">{goal.selfScore} 点</div>
                          <div className="text-xs text-gray-500 mb-1">自己評価コメント</div>
                          <div className="text-sm">{goal.selfComment}</div>
                        </div>
                      </div>
                      {/* 上司コメント（左寄せ） */}
                      <div className="flex justify-start">
                        <div className="bg-white border border-blue-200 rounded-xl px-5 py-3 w-[80%] shadow">
                          <Label className="text-xs text-gray-500">上司コメント</Label>
                          <Textarea
                            value={supervisorInputs[emp.id].goals[idx]}
                            onChange={e => handleSupervisorInput("goals", idx, e.target.value)}
                            placeholder="上司としてのコメントを入力"
                            className="mt-1 text-sm rounded-md border-gray-300 bg-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                {/* コンピテンシー評価 */}
                <Card className="bg-green-50 border border-green-100 rounded-2xl shadow-sm px-6 py-5">
                  <div className="mb-2 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-green-500" />
                    <span className="font-semibold text-green-700">{emp.competency.name}</span>
                    <Badge className="bg-green-600 text-white">コンピテンシー</Badge>
                  </div>
                  <div className="flex flex-col gap-4">
                    {/* 部下の自己評価（右寄せ） */}
                    <div className="flex justify-end">
                      <div className="bg-green-100 text-green-900 rounded-xl px-5 py-3 w-[80%] shadow">
                        <div className="text-xs text-gray-500 mb-1">自己評価スコア</div>
                        <div className="font-bold text-lg mb-1">{emp.competency.selfScore} 点</div>
                        <div className="text-xs text-gray-500 mb-1">自己評価コメント</div>
                        <div className="text-sm">{emp.competency.selfComment}</div>
                      </div>
                    </div>
                    {/* 上司コメント（左寄せ） */}
                    <div className="flex justify-start">
                      <div className="bg-white border border-green-200 rounded-xl px-5 py-3 w-[80%] shadow">
                        <Label className="text-xs text-gray-500">上司コメント</Label>
                        <Textarea
                          value={supervisorInputs[emp.id].competency}
                          onChange={e => handleSupervisorInput("competency", null, e.target.value)}
                          placeholder="上司としてのコメントを入力"
                          className="mt-1 text-sm rounded-md border-gray-300 bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
                {/* コアバリュー評価 */}
                <Card className="bg-purple-50 border border-purple-100 rounded-2xl shadow-sm px-6 py-5">
                  <div className="mb-2 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-purple-500" />
                    <span className="font-semibold text-purple-700">コアバリュー評価</span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {/* 部下の自己評価（右寄せ） */}
                    <div className="flex justify-end">
                      <div className="bg-purple-100 text-purple-900 rounded-xl px-5 py-3 w-[80%] shadow">
                        <div className="text-xs text-gray-500 mb-1">自己評価コメント</div>
                        <div className="text-sm">{emp.coreValue.selfComment}</div>
                      </div>
                    </div>
                    {/* 上司コメント（左寄せ） */}
                    <div className="flex justify-start">
                      <div className="bg-white border border-purple-200 rounded-xl px-5 py-3 w-[80%] shadow">
                        <Label className="text-xs text-gray-500">上司コメント</Label>
                        <Textarea
                          value={supervisorInputs[emp.id].coreValue}
                          onChange={e => handleSupervisorInput("coreValue", null, e.target.value)}
                          placeholder="上司としてのコメントを入力"
                          className="mt-1 text-sm rounded-md border-gray-300 bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
                {/* 送信ボタン（ダミー） */}
                <div className="flex justify-end pt-4">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-6 py-2" disabled>
                    フィードバック送信
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
